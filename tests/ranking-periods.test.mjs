import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../features-ranking.js",import.meta.url),"utf8");
let counter=0;
function create(){
 const DEMO={
  matches:[{id:1,starts_at:"2026-11-07T12:00:00.000Z"},{id:2,starts_at:"2026-10-31T12:00:00.000Z"},
   {id:3,starts_at:"2027-01-09T12:00:00.000Z"}],
  regs:[{id:1,member_id:1,match_id:1,status:"paid",name:"Benitez",attended:1},
    {id:2,member_id:2,match_id:1,status:"paid",name:"João",attended:1},
    {id:3,member_id:1,match_id:2,status:"paid",name:"Benitez",attended:1},
    {id:4,member_id:2,match_id:3,status:"paid",name:"João",attended:1}],
  stats:[{registration_id:1,goals:2,assists:0},{registration_id:2,goals:0,assists:2},
    {registration_id:3,goals:4,assists:0},{registration_id:4,goals:10,assists:0}],
  votes:[{match_id:1,voter_member_id:1,voted_registration_id:2}],
  adminLogged:true
 };
 let saves=0;const events=[];
 const window={fetch:async()=>new Response(JSON.stringify({demo:true}),{status:200}),
  FUTEBOL_record_event:(...args)=>events.push(args)};
 const ctx={DEMO,saveDemo:()=>saves++,window,crypto:{randomUUID:()=>"period-"+(++counter)},
   Response,Date,Intl,URLSearchParams,structuredClone,Math,console};
 vm.runInNewContext(source,ctx,{filename:"features-ranking.js"});
 const fetch=async(path,method="GET",body=null)=>{
   const r=await window.fetch(path,{method,...(body?{body:JSON.stringify(body)}:{})});
   return {status:r.status,body:await r.json()};
 };
 return {DEMO,window,fetch,events,saves:()=>saves};
}
test("ranking 2026 considera data da partida, não de pagamento",async()=>{
 const c=create(),r=await c.fetch("/api/ranking");
 assert.equal(r.status,200);assert.equal(r.body.period.status,"open");
 const p=r.body.ranking.find(x=>x.name==="Benitez");
 assert.equal(p.gols,6);assert.equal(p.presencas,2);
 assert.equal(r.body.ranking.find(x=>x.name==="João").gols,0);
 assert.equal(r.body.ranking.find(x=>x.name==="João").pontos,10);
});
test("criação retroativa e edição de datas sem bloquear passado",async()=>{
 const c=create();
 const created=await c.fetch("/api/admin/ranking-periods","POST",{title:"Outubro retroativo",start_date:"2026-10-01",end_date:"2026-10-31"});
 assert.equal(created.status,201);assert.equal(created.body.period.status,"draft");
 const id=created.body.period.id;
 const open=await c.fetch("/api/admin/ranking-periods/"+id+"/open","POST");
 assert.equal(open.status,200);
 const r=await c.fetch("/api/ranking?period="+id);
 assert.equal(r.body.ranking.length,1);
 assert.equal(r.body.ranking[0].gols,4);
 const edit=await c.fetch("/api/admin/ranking-periods/"+id,"PATCH",{end_date:"2026-11-30"});
 assert.equal(edit.status,200);assert.equal(edit.body.period.end_date,"2026-11-30");
 const after=await c.fetch("/api/ranking?period="+id);
 assert.equal(after.body.ranking.length,2);
});
test("encerrar congela classificação, reabrir recalcula e salva versões",async()=>{
 const c=create(),period=(await c.fetch("/api/ranking")).body.period;
 const closed=await c.fetch("/api/admin/ranking-periods/"+period.id+"/close","POST");
 assert.equal(closed.status,200);assert.equal(closed.body.period.status,"closed");
 const before=(await c.fetch("/api/ranking?period="+period.id)).body.ranking.find(x=>x.name==="Benitez").pontos;
 c.DEMO.stats.find(s=>s.registration_id===1).goals=50;
 const frozen=(await c.fetch("/api/ranking?period="+period.id)).body.ranking.find(x=>x.name==="Benitez").pontos;
 assert.equal(frozen,before);
 assert.equal((await c.fetch("/api/admin/ranking-periods/"+period.id,"PATCH",{start_date:"2026-01-01"})).status,409);
 assert.equal((await c.fetch("/api/admin/ranking-periods/"+period.id+"/open","POST")).status,200);
 const recalculated=(await c.fetch("/api/ranking?period="+period.id)).body.ranking.find(x=>x.name==="Benitez").pontos;
 assert.ok(recalculated>frozen);
 await c.fetch("/api/admin/ranking-periods/"+period.id+"/close","POST");
 assert.equal(c.DEMO.rankPeriods[0].closures.length,2);
 assert.ok(c.events.some(e=>e[0]==="RANKING_REABERTO"));
});
test("validação de datas e autorização Master",async()=>{
 const c=create();
 let r=await c.fetch("/api/admin/ranking-periods","POST",{title:"Inválido",start_date:"2026-02-30",end_date:"2026-03-01"});
 assert.equal(r.status,422);
 r=await c.fetch("/api/admin/ranking-periods","POST",{title:"Trocado",start_date:"2026-12-31",end_date:"2026-01-01"});
 assert.equal(r.status,422);
 c.DEMO.adminLogged=false;
 assert.equal((await c.fetch("/api/admin/ranking-periods","POST",{title:"Teste",start_date:"2026-01-01",end_date:"2026-12-01"})).status,401);
 const id=c.DEMO.rankPeriods[0].id;
 assert.equal((await c.fetch("/api/admin/ranking-periods/"+id+"/close","POST")).status,401);
});
test("preserva temporadas anteriores ao criar e reabrir",async()=>{
 const c=create(),first=c.DEMO.rankPeriods[0].id;
 const added=await c.fetch("/api/admin/ranking-periods","POST",{title:"Janeiro retroativo",start_date:"2026-01-01",end_date:"2026-01-31"});
 await c.fetch("/api/admin/ranking-periods/"+added.body.period.id+"/open","POST");
 const records=(await c.fetch("/api/ranking")).body.periods;
 assert.equal(records.length,2);
 assert.ok(records.some(x=>x.id===first));
 assert.ok(records.some(x=>x.id===added.body.period.id));
});
