// V10: autenticação real para membros. Rotas admin devem passar pela proteção
// Cloudflare Access + MASTER_API_KEY já existente no Worker. Sem SMS ou cadastro aberto.
const encoder=new TextEncoder();
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const fromHex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
const iso=()=>new Date().toISOString();
const normalize=e=>String(e||"").trim().toLowerCase();
const emailOk=e=>e.length<=160&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const reply=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const err=(status,message)=>reply({error:message},status);
async function json(request){const text=await request.text();if(text.length>8000)throw Error("Dados muito grandes");try{return JSON.parse(text)}catch{throw Error("JSON inválido")}}
async function sha(data){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(data))))}
function validPassword(p){if(typeof p!=="string"||p.length<12||p.length>128||!/[A-Za-zÀ-ÿ]/.test(p)||!/\d/.test(p))throw Error("A senha deve ter 12 a 128 caracteres, incluindo letras e números.")}
async function passwordRecord(p){validPassword(p);const salt=crypto.getRandomValues(new Uint8Array(16));const iterations=250000;const key=await crypto.subtle.importKey("raw",encoder.encode(p),"PBKDF2",false,["deriveBits"]);const hash=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);return {salt:hex(salt),password_hash:hex(new Uint8Array(hash)),iterations}}
async function validHash(p,c){
 if(!c||!c.salt||!c.password_hash||!Number.isInteger(c.iterations)||c.iterations<100000)return false;
 const salt=fromHex(c.salt);if(salt.length!==16)return false;
 const key=await crypto.subtle.importKey("raw",encoder.encode(String(p||"")),"PBKDF2",false,["deriveBits"]);
 const v=hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:c.iterations,hash:"SHA-256"},key,256)));
 // compare digest values in constant work
 let diff=0;for(let i=0;i<v.length;i++)diff|=v.charCodeAt(i)^c.password_hash.charCodeAt(i);
 return v.length===c.password_hash.length&&diff===0;
}
async function audit(db,event,actor,target){await db.prepare("INSERT INTO user_security_audit(id,actor_account_id,target_account_id,event) VALUES(?,?,?,?)").bind(crypto.randomUUID(),actor||null,target||null,event).run()}
async function session(db,request){
 const authorization=request.headers.get("Authorization")||"";
 if(!/^Bearer [a-f0-9]{64}$/.test(authorization))return null;
 const hash=await sha(authorization.slice(7));
 return await db.prepare("SELECT a.id,a.member_id,a.email,a.role,a.active,s.id AS session_id FROM user_sessions s JOIN user_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.active=1").bind(hash,iso()).first();
}
function safeUser(a){return {id:a.id,member_id:a.member_id,email:a.email,role:a.role}}
async function userRoute(request,db,path){
 const method=request.method;
 if(path==="/api/auth/login"&&method==="POST"){
  const input=await json(request),email=normalize(input.email);
  if(!emailOk(email)||typeof input.password!=="string")return err(401,"Credenciais inválidas");
  const limit=await db.prepare("SELECT failed_count,locked_until FROM user_login_limits WHERE email=?").bind(email).first();
  if(limit?.locked_until&&limit.locked_until>iso())return err(429,"Muitas tentativas. Tente mais tarde.");
  const a=await db.prepare("SELECT a.*,c.password_hash,c.salt,c.iterations FROM user_accounts a LEFT JOIN user_credentials c ON c.account_id=a.id WHERE a.email=?").bind(email).first();
  const ok=!!a?.active&&await validHash(input.password,a);
  if(!ok){
   const count=Number(limit?.failed_count||0)+1;
   const locked=count>=5?new Date(Date.now()+15*60*1000).toISOString():null;
   await db.prepare("INSERT INTO user_login_limits(email,failed_count,locked_until) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failed_count=excluded.failed_count,locked_until=excluded.locked_until").bind(email,locked?0:count,locked).run();
   return err(401,"Credenciais inválidas");
  }
  await db.prepare("DELETE FROM user_login_limits WHERE email=?").bind(email).run();
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),id=crypto.randomUUID();
  const expires=new Date(Date.now()+8*60*60*1000).toISOString();
  await db.prepare("INSERT INTO user_sessions(id,account_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)").bind(id,a.id,await sha(token),iso(),expires).run();
  await audit(db,"LOGIN_OK",a.id,a.id);
  return reply({token,expires_at:expires,account:safeUser(a)});
 }
 const a=await session(db,request);
 if(!a)return err(401,"Sessão inválida ou expirada");
 if(path==="/api/auth/me"&&method==="GET")return reply({account:safeUser(a)});
 if(path==="/api/auth/logout"&&method==="POST"){
  await db.prepare("UPDATE user_sessions SET revoked_at=? WHERE id=?").bind(iso(),a.session_id).run();
  await audit(db,"LOGOUT",a.id,a.id);return reply({ok:true});
 }
 if(path==="/api/auth/change-password"&&method==="POST"){
  const input=await json(request);
  const c=await db.prepare("SELECT * FROM user_credentials WHERE account_id=?").bind(a.id).first();
  if(!await validHash(input.current_password,c))return err(403,"Senha atual incorreta");
  const p=await passwordRecord(input.new_password);
  if(input.new_password===input.current_password)return err(400,"Escolha uma senha diferente");
  await db.batch([
   db.prepare("UPDATE user_credentials SET password_hash=?,salt=?,iterations=?,changed_at=? WHERE account_id=?").bind(p.password_hash,p.salt,p.iterations,iso(),a.id),
   db.prepare("UPDATE user_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL").bind(iso(),a.id)
  ]);
  await audit(db,"PASSWORD_CHANGED",a.id,a.id);return reply({ok:true,login_required:true});
 }
 return err(404,"Rota não encontrada");
}
export async function authRoute(request,db,path){
 try{return await userRoute(request,db,path)}catch(e){
  if(/^(A senha|Escolha|Dados|JSON)/.test(String(e.message)))return err(400,e.message);
  return err(500,"Falha interna de autenticação");
 }
}
// Chamado apenas DEPOIS da verificação Cloudflare Access + token privado Master.
export async function masterAccountRoute(request,db,path){
 try{
  if(path==="/api/admin/accounts"&&request.method==="GET"){
   const r=await db.prepare("SELECT id,member_id,email,role,active,created_at FROM user_accounts ORDER BY created_at DESC LIMIT 200").all();
   return reply({accounts:r.results||[]});
  }
  if(path==="/api/admin/accounts"&&request.method==="POST"){
   const d=await json(request),email=normalize(d.email),role=String(d.role||"member");
   if(!emailOk(email)||!["member","admin"].includes(role))return err(400,"E-mail ou papel inválido");
   const p=await passwordRecord(d.password);
   const id=crypto.randomUUID(),stamp=iso();
   // A criação é administrativa; associação com membro exige conferência prévia.
   const memberId=d.member_id||null;
   await db.batch([
    db.prepare("INSERT INTO user_accounts(id,member_id,email,role,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)").bind(id,memberId,email,role,stamp,stamp),
    db.prepare("INSERT INTO user_credentials(account_id,password_hash,salt,iterations) VALUES(?,?,?,?)").bind(id,p.password_hash,p.salt,p.iterations)
   ]);
   await audit(db,"ACCOUNT_CREATED",null,id);
   return reply({account:{id,email,role,member_id:memberId}},201);
  }
  const match=path.match(/^\/api\/admin\/accounts\/([a-f0-9-]{36})\/(reset-password|disable)$/);
  if(match&&request.method==="POST"){
   const id=match[1],action=match[2],a=await db.prepare("SELECT id,role FROM user_accounts WHERE id=?").bind(id).first();
   if(!a)return err(404,"Conta não encontrada");
   if(a.role==="master")return err(403,"Conta Master não pode ser alterada por esta rota");
   if(action==="disable"){
    await db.batch([
     db.prepare("UPDATE user_accounts SET active=0,updated_at=? WHERE id=?").bind(iso(),id),
     db.prepare("UPDATE user_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL").bind(iso(),id)
    ]);
    await audit(db,"ACCOUNT_DISABLED",null,id);return reply({ok:true});
   }
   const d=await json(request),p=await passwordRecord(d.new_password);
   await db.batch([
    db.prepare("UPDATE user_credentials SET password_hash=?,salt=?,iterations=?,changed_at=? WHERE account_id=?").bind(p.password_hash,p.salt,p.iterations,iso(),id),
    db.prepare("UPDATE user_sessions SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL").bind(iso(),id)
   ]);
   await audit(db,"ADMIN_PASSWORD_RESET",null,id);return reply({ok:true,login_required:true});
  }
  return err(404,"Rota não encontrada");
 }catch(e){
  if(/UNIQUE|FOREIGN KEY/.test(String(e.message)))return err(409,"E-mail ou membro já cadastrado, ou vínculo inválido");
  if(/^(A senha|Dados|JSON)/.test(String(e.message)))return err(400,e.message);
  return err(500,"Falha interna na gestão de contas");
 }
}
