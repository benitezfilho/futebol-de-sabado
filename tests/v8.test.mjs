import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../features-v8.js",import.meta.url),"utf8");
function makeDemo() {
 const match={id:1,title:"Futebol de Sábado",venue:"Farofa Society",capacity:22,goalie_limit:2};
 const line=Array.from({length:22},(_,i)=>({
   id:i+1,match_id:1,member_id:i+1,name:"Jogador "+(i+1),role:"linha",status:"paid",
   paid_at:new Date(Date.now()-60000*(40-i)).toISOString(),created_at:new Date().toISOString(),token:"j-"+i
 }));
 const goalies=Array.from({length:2},(_,i)=>({
   id:i+23,match_id:1,member_id:i+23,name:"Goleiro "+i,role:"goleiro",status:"paid",token:"g-"+i
 }));
 const demo={matches:[match],regs:[...line,...goalies],members:[],interests:[],notices:[],teams:[],
   events:[],rotation:{},bench:{},adminLogged:true};
 let writes=0,serial=0;
 const context={DEMO:demo,saveDemo:()=>{writes++;},window:{fetch:async()=>new Response(JSON.stringify({}),{status:200})},
  crypto:{randomUUID:()=>String(++serial)},Response,Date,Math,URL,Image:class{},document:{},console};
 vm.runInNewContext(source,context,{filename:"features-v8.js"});
 return {demo,fetch:context.window.fetch,getWrites:()=>writes,ctx:context};
}
test("quatro times completos de cinco e dois reservas de linha; goleiros fora da capacidade",async()=>{
 const x=makeDemo();
 const r=await x.fetch("/api/admin/matches/1/draw",{method:"POST",body:JSON.stringify({team_count:4})});
 assert.equal(r.status,200);
 assert.equal(x.demo.teams.length,4);
 for(const team of x.demo.teams){
   assert.equal(team.players.length,5);
   assert.equal(team.players.every(id=>id<=22),true);
 }
 assert.equal(x.demo.bench[1].length,2);
 const starters=x.demo.teams.slice(0,2).flatMap(x=>x.players).sort((a,b)=>a-b);
 assert.deepEqual(starters,Array.from({length:10},(_,i)=>i+1));
 assert.equal(x.demo.regs.filter(r=>r.role==="goleiro").length,2);
});
test("sorteio não cria time incompleto",async()=>{
 const x=makeDemo();
 const r=await x.fetch("/api/admin/matches/1/draw",{method:"POST",body:JSON.stringify({team_count:5})});
 assert.equal(r.status,422);
 assert.equal(x.demo.teams.length,0);
});
test("rodízio começa A x B; perdedor sai, C entra e vai para fim da fila",async()=>{
 const x=makeDemo();
 await x.fetch("/api/admin/matches/1/draw",{method:"POST",body:JSON.stringify({team_count:4})});
 const result=await x.fetch("/api/admin/matches/1/rotation",{method:"POST",body:JSON.stringify({winner:"Time A"})});
 assert.equal(result.status,200);
 assert.deepEqual(x.demo.rotation[1].playing,["Time A","Time C"]);
 assert.deepEqual(x.demo.rotation[1].waiting,["Time D","Time B"]);
 assert.equal(x.demo.rotation[1].games[0].leaves,"Time B");
});
test("cancela e restaura pagante quando existe vaga",async()=>{
 const x=makeDemo();
 const r=x.demo.regs[0];r.status="cancelled";r.previous_status="paid";r.previous_paid_at=r.paid_at;
 const out=await x.fetch("/api/admin/registrations/1/restore",{method:"POST"});
 assert.equal(out.status,200);
 assert.equal(r.status,"paid");
 assert.equal(x.demo.events.some(e=>e.action==="INSCRICAO_RESTAURADA"),true);
});
test("restauração não ultrapassa lotação",async()=>{
 const x=makeDemo();
 const r=x.demo.regs[0];r.status="cancelled";r.previous_status="paid";
 x.demo.regs.push({id:50,match_id:1,member_id:50,name:"Reserva",role:"linha",status:"paid"});
 const out=await x.fetch("/api/admin/registrations/1/restore",{method:"POST"});
 assert.equal(out.status,409);
 assert.equal(r.status,"cancelled");
});
test("convocado confirmado sai dos avisos ativos e fica no histórico",()=>{
 const x=makeDemo();
 const r=x.demo.regs[23];r.status="reserved";
 x.demo.notices.push({id:1,match_id:1,token:r.token,name:r.name,message:"Convocado"});
 x.ctx.saveDemo();
 r.status="paid";
 x.ctx.saveDemo();
 assert.equal(x.demo.notices.length,0);
 assert.equal(x.demo.events.some(e=>e.action==="PAGAMENTO_CONFIRMADO"),true);
 assert.equal(x.demo.events.some(e=>e.action==="CONVOCACAO_FINALIZADA"),true);
});
