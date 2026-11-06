import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";

function make(){
 const saved=new Map(),members=[],DEMO={members,memberLogged:null,adminLogged:false};
 const window={};
 const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
 const source=fs.readFileSync(new URL("../features-member-accounts.js",import.meta.url),"utf8");
 vm.runInNewContext(source,{DEMO,window,localStorage,saveDemo:()=>{},crypto:webcrypto,TextEncoder,Uint8Array,Date,Math,Set,Error,Number,String});
 return {api:window.FUTEBOL_memberAccounts,DEMO,saved};
}
test("cadastro local e acesso por e-mail e senha",async()=>{
 const {api}=make();
 await api.signup({name:"Jogador Teste",email:"teste@example.com",phone:"62999991234",password:"SenhaLocalTeste2026",confirmation:"SenhaLocalTeste2026"});
 assert.equal((await api.signIn("teste@example.com","SenhaLocalTeste2026")).name,"Jogador Teste");
 await assert.rejects(api.signIn("teste@example.com","SenhaIncorreta2026"));
});
test("reset exclusivo do Master, com token único",async()=>{
 const {api,DEMO,saved}=make();
 const m=await api.signup({name:"Jogador Teste",email:"teste@example.com",phone:"62999991234",password:"SenhaLocalTeste2026",confirmation:"SenhaLocalTeste2026"});
 await assert.rejects(api.adminReset(m.id));
 DEMO.adminLogged=true;
 const reset=await api.adminReset(m.id);
 assert.equal(reset.code.length,24);
 assert.equal(JSON.stringify([...saved.values()]).includes(reset.code),false);
 await assert.rejects(api.signIn(m.email,"SenhaLocalTeste2026"));
 await api.redeemReset(m.email,reset.code,"SenhaNova2026","SenhaNova2026");
 await assert.rejects(api.redeemReset(m.email,reset.code,"SenhaOutra2026","SenhaOutra2026"));
 assert.equal((await api.signIn(m.email,"SenhaNova2026")).id,m.id);
});
