import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import {webcrypto} from "node:crypto";

const manualSource=fs.readFileSync(new URL("../features-manual-draw.js",import.meta.url),"utf8");
const memberSource=fs.readFileSync(new URL("../features-admin-member.js",import.meta.url),"utf8");
function setup(source,fixture={}){
 const DEMO={matches:[{id:1,status:"active",capacity:22,goalie_limit:2,title:"Jogo teste"}],
   regs:[],members:[],interests:[],adminLogged:true,...fixture};
 let saved=0,events=[];
 const window={FUTEBOL_record_event:(...a)=>events.push(a)};
 const ctx={DEMO,saveDemo:()=>saved++,window,Date,Math,crypto:webcrypto,
   Uint32Array,Set,Number,String,Error,Array,console};
 vm.runInNewContext(source,ctx,{filename:"module.js"});
 return {DEMO,window,events,saves:()=>saved};
}
const attendees=n=>Array.from({length:n},(_,i)=>"Jogador "+(i+1)).join("\n");
test("15 presentes: três times completos de 5, zero reservas",()=>{
 const t=setup(manualSource);
 const x=t.window.FUTEBOL_manualDraw.calculate(attendees(15),"Terror do Ferreira",5,arr=>arr);
 assert.equal(x.teams.length,3);
 assert.deepEqual(Array.from(x.teams,team=>team.players.length),[5,5,5]);
 assert.equal(x.reserves.length,0);
 assert.equal(x.goalkeepers[0],"Terror do Ferreira");
 assert.equal(x.teams.flatMap(y=>y.players).includes("Terror do Ferreira"),false);
});
test("17 presentes: três times de 5 e dois reservas",()=>{
 const t=setup(manualSource);
 const x=t.window.FUTEBOL_manualDraw.calculate(attendees(17),"",5,arr=>arr);
 assert.equal(x.teams.length,3);assert.equal(x.reserves.length,2);
 assert.deepEqual(Array.from(x.reserves),["Jogador 16","Jogador 17"]);
});
test("Quantidade de 1 a 6 por time, sem times incompletos",()=>{
 const t=setup(manualSource),d=t.window.FUTEBOL_manualDraw;
 for(let size=1;size<=6;size++){
  const x=d.calculate(attendees(17),"",size,arr=>arr);
  assert.equal(x.teams.length,Math.floor(17/size));
  assert.ok(x.teams.every(team=>team.players.length===size));
  assert.equal(x.reserves.length,17%size);
 }
 assert.throws(()=>d.calculate(attendees(17),"",7),/1 e 6/);
 assert.throws(()=>d.calculate(attendees(8),"",5),/pelo menos 10/);
});
test("duplicidade em listas e entre linha e goleiros bloqueada",()=>{
 const t=setup(manualSource),d=t.window.FUTEBOL_manualDraw;
 assert.throws(()=>d.parse("João\nJoao",""),/repetido/);
 assert.throws(()=>d.parse("Ana\nJoao","João"),/duas listas/);
});
test("Sorteio manual não altera inscritos, Pix ou escalação oficial",()=>{
 const paid={id:1,status:"paid",role:"linha"};
 const t=setup(manualSource,{regs:[paid],teams:[{name:"Time A"}]});
 t.window.FUTEBOL_manualDraw.draw(1,{lines:attendees(15),goalies:"",size:5});
 assert.equal(t.DEMO.regs[0].status,"paid");
 assert.equal(t.DEMO.teams.length,1);
 assert.equal(t.window.FUTEBOL_manualDraw.state(1).result.teams.length,3);
 assert.ok(t.saves()>0);
});
test("Membro manual é salvo com identidade não verificada e sem confirmar Pix",()=>{
 const t=setup(memberSource);
 const out=t.window.FUTEBOL_adminMember.add({name:"Carlos Augusto",email:"carlos@example.com",phone:"(62) 99999-1234",role:"linha",match_id:1});
 assert.equal(out.status,"reserved");
 assert.equal(t.DEMO.members[0].verified_at,null);
 assert.equal(t.DEMO.members[0].admin_created,true);
 assert.equal(t.DEMO.regs[0].status,"reserved");
 assert.equal(t.DEMO.regs[0].paid_at,null);
 assert.equal(t.DEMO.regs[0].role,"linha");
});
test("Cadastro Master rejeita duplicação de telefone e email",()=>{
 const t=setup(memberSource),p=t.window.FUTEBOL_adminMember;
 p.add({name:"Carlos Augusto",email:"carlos@example.com",phone:"(62) 99999-1234"});
 assert.throws(()=>p.add({name:"Pessoa Dois",email:"outro@example.com",phone:"62999991234"}),/já cadastrado/);
 assert.throws(()=>p.add({name:"Pessoa Tres",email:"CARLOS@example.com",phone:"(62) 99999-5678"}),/já cadastrado/);
});
test("Admin cadastra goleiro sem ocupar vagas da linha",()=>{
 const t=setup(memberSource);
 const r=t.window.FUTEBOL_adminMember.add({name:"Felipe Botelho",email:"felipe@example.com",phone:"(62) 99999-1234",role:"goleiro",match_id:1});
 assert.equal(r.status,"reserved");
 assert.equal(t.DEMO.regs[0].role,"goleiro");
 assert.equal(t.DEMO.regs[0].paid_at,null);
});
test("Lotação cheia respeitada e registro é interesse histórico",()=>{
 const occupied=Array.from({length:22},(_,i)=>({id:i+1,match_id:1,role:"linha",status:"paid"}));
 const t=setup(memberSource,{regs:occupied});
 const r=t.window.FUTEBOL_adminMember.add({name:"Carlos Augusto",email:"carlos@example.com",phone:"(62) 99999-1234",role:"linha",match_id:1});
 assert.equal(r.status,"interest");
 assert.equal(t.DEMO.regs.length,22);
 assert.equal(t.DEMO.interests.length,1);
});
test("Vaga ocupada por pendentes manda novo inscrito para espera manual",()=>{
 const occupied=Array.from({length:22},(_,i)=>({id:i+1,match_id:1,role:"linha",status:i===21?"reserved":"paid"}));
 const t=setup(memberSource,{regs:occupied});
 const r=t.window.FUTEBOL_adminMember.add({name:"Carlos Augusto",email:"carlos@example.com",phone:"(62) 99999-1234",role:"linha",match_id:1});
 assert.equal(r.status,"waitlist");
 assert.equal(t.DEMO.regs.at(-1).queue_hold,1);
});
test("Sem sessão do Master não permite cadastrar pessoas",()=>{
 const t=setup(memberSource,{adminLogged:false});
 assert.throws(()=>t.window.FUTEBOL_adminMember.add({name:"Carlos Augusto",email:"carlos@example.com",phone:"62999991234"}),/Somente Admin Master/);
 assert.equal(t.DEMO.members.length,0);
});
