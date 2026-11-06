import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
function loadSeed() {
 const from=html.indexOf("const DBKEY=");
 const to=html.indexOf("function currentMember()",from);
 assert.ok(from>0 && to>from,"Demonstração possui o carregador inicial");
 const code=html.slice(from,to);
 const state=new Map();
 const ctx={
   localStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,String(v))},
   saveDemo:()=>{},
   Date,
   console
 };
 const result=vm.runInNewContext(code+"\nDEMO",ctx);
 return {demo:result,storage:state};
}
const firstTen=["Hadrian","Yuri","João","Heitor","Eduardo","Luis Fabiano","Alexandre","Benitez","Rodrigo","Marcos Felipe"];
const otherTen=["CH","Alan","Pinguim","Ferreira","Gustavo","Wallyson","Yan","Pedro Augusto","Caio Cabeça","Kayo Oreia"];
const originalList=["Benitez","João","Ferreira","CH","Alan","Pinguim","Gustavo","Wallyson","Eduardo","Luis Fabiano","Alexandre","Yuri","Yan","Caio Cabeça","Rodrigo","Hadrian","Heitor","Pedro Augusto","Kayo Oreia","Marcos Felipe"];
test("20 jogadores de linha pagos, duas vagas livres, sem reservas pendentes",()=>{
 const m=loadSeed().demo;
 const registrations=m.regs.filter(x=>x.match_id===m.matches[0].id);
 assert.equal(m.matches[0].capacity,22);
 assert.equal(registrations.filter(x=>x.role==="linha"&&x.status==="paid").length,20);
 assert.equal(registrations.filter(x=>x.role==="linha"&&x.status==="reserved").length,0);
 assert.equal(registrations.filter(x=>x.role==="goleiro").length,1);
 assert.equal(registrations.filter(x=>x.role==="goleiro"&&x.status==="paid")[0].name,"Terror do Ferreira");
});
test("ordem 1 a 20 da lista original preservada",()=>{
 const m=loadSeed().demo;
 const line=m.regs.filter(x=>x.role==="linha"&&x.status==="paid");
 assert.deepEqual(Array.from(line,x=>x.name),originalList);
});
test("top 10 e demais 10 seguem a ordem exata do pagamento",()=>{
 const m=loadSeed().demo;
 const ordered=m.regs.filter(x=>x.role==="linha"&&x.status==="paid").sort((a,b)=>a.paid_at.localeCompare(b.paid_at));
 assert.deepEqual(Array.from(ordered.slice(0,10),x=>x.name),firstTen);
 assert.deepEqual(Array.from(ordered.slice(10,20),x=>x.name),otherTen);
 assert.equal(new Set(ordered.map(x=>x.paid_at)).size,20);
});
test("JV Negro na lista de espera sem prioridade, fora das 22 vagas",()=>{
 const m=loadSeed().demo;
 const jv=m.regs.find(x=>x.name==="JV Negro");
 assert.equal(jv.status,"waitlist");
 assert.equal(jv.role,"linha");
 assert.equal(jv.queue_hold,1);
 assert.equal(m.regs.filter(x=>x.status==="waitlist").length,1);
});
test("sem CPF/chave Pix ou contatos verdadeiros publicados no seed",()=>{
 const m=loadSeed().demo;
 assert.equal(m.matches[0].price_cents,1500);
 assert.equal(m.regs.every(x=>x.phone===""),true);
 assert.equal(m.members.every(x=>x.email.endsWith("@example.invalid")),true);
 assert.equal(html.includes("712.006.971-38"),false);
});
