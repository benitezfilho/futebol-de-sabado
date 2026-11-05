import { validateMatch, paymentDue } from "./logic.js";

const now = () => new Date().toISOString();
function reply(data,status=200,headers={}) {
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
}
function fail(error,status=400,headers={}) {return reply({error},status,headers);}
function cors(request,env) {
 const origin=request.headers.get("Origin"),allowed=env.SITE_ORIGIN||"https://benitezfilho.github.io";
 if(origin && origin!==allowed) return null;
 return {"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Vary":"Origin"};
}
async function sameSecret(a,b) {
 const digest=async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
 const [x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;
 for(let i=0;i<x.length;i++) diff|=x[i]^y[i];
 return diff===0;
}
async function allowMaster(request,env) {
 if(!env.MASTER_API_KEY || env.MASTER_API_KEY.length<32)return false;
 const value=request.headers.get("Authorization")||"";
 return value.startsWith("Bearer ") && await sameSecret(value.slice(7),env.MASTER_API_KEY);
}
async function body(request) {
 const s=await request.text();
 if(s.length>20000)throw Error("JSON grande demais");
 try{return JSON.parse(s)}catch{throw Error("JSON inválido")}
}
const columns = "m.id,m.title,m.venue,m.starts_at,m.opens_at,m.payment_deadline_at,m.queue_release_at,m.interest_closes_at,m.capacity_outfield,m.max_goalkeepers,m.price_cents,m.queue_payment_minutes,m.status";
const stats = "COALESCE(SUM(CASE WHEN r.is_goalkeeper=0 AND r.status='confirmed' THEN 1 ELSE 0 END),0) AS confirmed,COALESCE(SUM(CASE WHEN r.is_goalkeeper=0 AND r.status='pending_payment' THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN r.is_goalkeeper=0 AND r.status='waitlist' THEN 1 ELSE 0 END),0) AS waitlist,COALESCE(SUM(CASE WHEN r.is_goalkeeper=0 AND r.status='interest' THEN 1 ELSE 0 END),0) AS interests,COALESCE(SUM(CASE WHEN r.is_goalkeeper=1 AND r.status='confirmed' THEN 1 ELSE 0 END),0) AS goalkeepers_confirmed";
const listing="SELECT "+columns+","+stats+" FROM matches m LEFT JOIN registrations r ON r.match_id=m.id";
async function audit(db,matchId,registrationId,action,actor="system") {
 await db.prepare("INSERT INTO audit_log(id,match_id,registration_id,actor,action) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),matchId,registrationId,actor,action).run();
}
async function processQueue(db,clock=now()) {
 const active=(await db.prepare("SELECT id,capacity_outfield,queue_payment_minutes,queue_release_at FROM matches WHERE status='active' AND starts_at>? ORDER BY starts_at LIMIT 100").bind(clock).all()).results||[];
 let expired=0,promoted=0;
 for(const m of active) {
   const out=await db.prepare("UPDATE registrations SET status='expired',updated_at=? WHERE match_id=? AND is_goalkeeper=0 AND status='pending_payment' AND payment_due_at<=? RETURNING id").bind(clock,m.id,clock).all();
   for(const item of out.results||[]) {expired++;await audit(db,m.id,item.id,"PAYMENT_EXPIRED");}
   if(m.queue_release_at>clock)continue;
   const q=await db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE match_id=? AND is_goalkeeper=0 AND status IN ('confirmed','pending_payment')").bind(m.id).first();
   const free=Math.max(0,m.capacity_outfield-Number(q?.n||0));
   if(!free)continue;
   const waiters=(await db.prepare("SELECT id FROM registrations WHERE match_id=? AND is_goalkeeper=0 AND status='waitlist' ORDER BY waitlisted_at,created_at,id LIMIT ?").bind(m.id,free).all()).results||[];
   for(const item of waiters) {
     const due=paymentDue(clock,m.queue_payment_minutes);
     const result=await db.prepare("UPDATE registrations SET status='pending_payment',payment_due_at=?,updated_at=? WHERE id=? AND status='waitlist' AND (SELECT COUNT(*) FROM registrations WHERE match_id=? AND is_goalkeeper=0 AND status IN ('confirmed','pending_payment')) < (SELECT capacity_outfield FROM matches WHERE id=?) RETURNING id")
       .bind(due,clock,item.id,m.id,m.id).all();
     if(result.results?.length){promoted++;await audit(db,m.id,item.id,"WAITLIST_PROMOTED");}
   }
 }
 return {expired,promoted,processed_at:clock};
}
async function createMatch(db,data) {
 const m=validateMatch(data),id=crypto.randomUUID();
 await db.prepare("INSERT INTO matches(id,title,venue,starts_at,opens_at,payment_deadline_at,queue_release_at,interest_closes_at,capacity_outfield,max_goalkeepers,price_cents,queue_payment_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,m.title,m.venue,m.starts_at,m.opens_at,m.payment_deadline_at,m.queue_release_at,m.interest_closes_at,m.capacity_outfield,m.max_goalkeepers,m.price_cents,m.queue_payment_minutes).run();
 await audit(db,id,null,"MATCH_CREATED","master");return id;
}
async function updateMatch(db,id,data) {
 const old=await db.prepare("SELECT * FROM matches WHERE id=? AND status='active'").bind(id).first();
 if(!old)return false;
 const m=validateMatch({...old,...data});
 const occupied=await db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE match_id=? AND is_goalkeeper=0 AND status IN ('confirmed','pending_payment')").bind(id).first();
 if(m.capacity_outfield<Number(occupied?.n||0))throw Error("Capacidade menor que vagas já reservadas");
 await db.prepare("UPDATE matches SET title=?,venue=?,starts_at=?,opens_at=?,payment_deadline_at=?,queue_release_at=?,interest_closes_at=?,capacity_outfield=?,max_goalkeepers=?,price_cents=?,queue_payment_minutes=?,updated_at=? WHERE id=?").bind(m.title,m.venue,m.starts_at,m.opens_at,m.payment_deadline_at,m.queue_release_at,m.interest_closes_at,m.capacity_outfield,m.max_goalkeepers,m.price_cents,m.queue_payment_minutes,now(),id).run();
 await audit(db,id,null,"MATCH_UPDATED","master");return true;
}
async function changeReg(db,id,action) {
 const row=await db.prepare("SELECT r.*,m.price_cents FROM registrations r JOIN matches m ON m.id=r.match_id WHERE r.id=?").bind(id).first();
 if(!row)return {error:"Inscrição não encontrada",status:404};
 const target={confirm:"confirmed",waitlist:"waitlist",cancel:"cancelled",restore:row.is_goalkeeper?"goalkeeper_pending":"waitlist"}[action];
 if(!target)return {error:"Ação inválida",status:400};
 if(action==="confirm" && !["pending_payment","goalkeeper_pending"].includes(row.status))return {error:"Não está pendente",status:409};
 if(action==="confirm" && !row.is_goalkeeper && row.payment_due_at && row.payment_due_at<=now())return {error:"Prazo expirado",status:409};
 if(action==="waitlist" && (row.is_goalkeeper || row.status!=="pending_payment"))return {error:"Somente linha pendente pode voltar à fila",status:409};
 if(action==="restore" && !["expired","cancelled"].includes(row.status))return {error:"Não está cancelado ou expirado",status:409};
 if(action==="cancel" && row.status==="cancelled")return {error:"Já cancelado",status:409};
 const timestamp=now();
 const updates=[
 db.prepare("UPDATE registrations SET status=?,updated_at=?,paid_at=?,waitlisted_at=? WHERE id=? AND status=?").bind(target,timestamp,target==="confirmed"?timestamp:row.paid_at||null,target==="waitlist"?timestamp:row.waitlisted_at||null,id,row.status),
 db.prepare("INSERT INTO audit_log(id,match_id,registration_id,actor,action) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),row.match_id,id,"master",action.toUpperCase())
 ];
 if(action==="confirm")updates.push(db.prepare("INSERT INTO payments(id,registration_id,amount_cents,method,recorded_by) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,row.is_goalkeeper?0:row.price_cents,row.is_goalkeeper?"exempt_goalkeeper":"manual_pix","master"));
 await db.batch(updates);
 return {id,status:target};
}
export default {
 async fetch(request,env,ctx) {
   const headers=cors(request,env);
   if(!headers)return fail("Origem não autorizada",403);
   if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
   const path=new URL(request.url).pathname.replace(/\/+$/,"")||"/";
   try {
     if(!env.DB)return fail("Banco D1 não configurado",503,headers);
     if(path==="/health" && request.method==="GET")return reply({ok:true,service:"futebol-de-sabado",registration_enabled:false},200,headers);
     if(path==="/api/matches" && request.method==="GET") {
       const result=await env.DB.prepare(listing+" WHERE m.status='active' GROUP BY m.id ORDER BY m.starts_at LIMIT 100").all();
       return reply({matches:result.results||[]},200,headers);
     }
     if(request.method==="GET" && /^\/api\/matches\/[a-f0-9-]{36}$/.test(path)) {
       const match=await env.DB.prepare(listing+" WHERE m.id=? AND m.status='active' GROUP BY m.id").bind(path.split("/")[3]).first();
       return match?reply({match},200,headers):fail("Partida não encontrada",404,headers);
     }
     if(path==="/api/member/register")return fail("Inscrições reais bloqueadas até ativar verificação segura do membro",503,headers);
     if(!path.startsWith("/api/admin/"))return fail("Rota não encontrada",404,headers);
     // Fail closed: todo acesso Master exige sessão verificada pelo Cloudflare Access.
     // A política de Access deve proteger /api/admin/* no hostname real do Worker.
     const masterEmail=String(env.MASTER_EMAIL||"").trim().toLowerCase();
     if(!masterEmail || !ctx?.access)return fail("Cloudflare Access exigido para o Master",403,headers);
     let verified=null;
     try{verified=await ctx.access.getIdentity()}catch{return fail("Sessão Access inválida",403,headers)}
     if(String(verified?.email||"").trim().toLowerCase()!==masterEmail)return fail("Identidade Master não autorizada",403,headers);
     if(!env.MASTER_API_KEY || env.MASTER_API_KEY.length<32)return fail("Segredo MASTER_API_KEY não configurado",503,headers);
     if(!await allowMaster(request,env))return fail("Master não autorizado",401,headers);
     if(request.method==="POST" && path==="/api/admin/matches")return reply({id:await createMatch(env.DB,await body(request))},201,headers);
     if(request.method==="PATCH" && /^\/api\/admin\/matches\/[a-f0-9-]{36}$/.test(path)) {
       const id=path.split("/")[4],ok=await updateMatch(env.DB,id,await body(request));
       return ok?reply({updated:true,id},200,headers):fail("Partida não encontrada ou arquivada",404,headers);
     }
     if(request.method==="POST" && /^\/api\/admin\/matches\/[a-f0-9-]{36}\/(archive|restore)$/.test(path)) {
       const parts=path.split("/"),id=parts[4],action=parts[5],status=action==="archive"?"archived":"active";
       const q=await env.DB.prepare("UPDATE matches SET status=?,updated_at=? WHERE id=? RETURNING id").bind(status,now(),id).all();
       if(!q.results?.length)return fail("Partida não encontrada",404,headers);
       await audit(env.DB,id,null,"MATCH_"+status.toUpperCase(),"master");
       return reply({id,status},200,headers);
     }
     if(request.method==="GET" && /^\/api\/admin\/matches\/[a-f0-9-]{36}\/registrations$/.test(path)) {
       const rows=(await env.DB.prepare("SELECT r.*,m.full_name,m.phone_e164,m.email FROM registrations r JOIN members m ON m.id=r.member_id WHERE r.match_id=? ORDER BY r.created_at LIMIT 500").bind(path.split("/")[4]).all()).results||[];
       return reply({registrations:rows},200,headers);
     }
     if(request.method==="POST" && /^\/api\/admin\/registrations\/[a-f0-9-]{36}\/(confirm|waitlist|cancel|restore)$/.test(path)) {
       const parts=path.split("/"),r=await changeReg(env.DB,parts[4],parts[5]);
       return r.error?fail(r.error,r.status,headers):reply(r,200,headers);
     }
     if(request.method==="POST" && path==="/api/admin/process")return reply(await processQueue(env.DB),200,headers);
     if(request.method==="GET" && path==="/api/admin/audit") {
       const r=await env.DB.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 300").all();
       return reply({events:r.results||[]},200,headers);
     }
     return fail("Rota não encontrada",404,headers);
   } catch(e) {
     const s=String(e?.message||"");
     if(/UNIQUE constraint/i.test(s))return fail("Registro duplicado",409,headers);
     if(/^(Informe|Data|Título|Local|Verifique|Capacidade|Quantidade|Valor|Prazo|Dados|JSON)/.test(s))return fail(s,400,headers);
     return fail("Erro interno. Verifique os logs do Worker.",500,headers);
   }
 },
 async scheduled(event,env,ctx) {
   ctx.waitUntil(processQueue(env.DB,new Date(event.scheduledTime||Date.now()).toISOString()));
 }
};
