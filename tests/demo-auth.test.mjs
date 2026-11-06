import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import {webcrypto} from "node:crypto";

const source=fs.readFileSync(new URL("../features-demo-auth.js",import.meta.url),"utf8");
function auth(){
 const saved=new Map(),window={};
 const localStorage={getItem:(k)=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
 vm.runInNewContext(source,{window,localStorage,crypto:webcrypto,TextEncoder,Uint8Array,Array,Error,String,JSON}, {filename:"features-demo-auth.js"});
 return {lock:window.FUTEBOL_demoAuth,saved};
}
test("demonstração exige criação de senha local ao primeiro acesso",async()=>{
 const {lock,saved}=auth();
 assert.equal(lock.configured(),false);
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026");
 assert.equal(lock.configured(),true);
 assert.equal(await lock.verify("SenhaLocalTeste2026"),true);
 assert.equal(await lock.verify("Errada2026"),false);
 const record=JSON.stringify([...saved.values()]);
 assert.equal(record.includes("SenhaLocalTeste2026"),false);
 assert.match(record,/salt/);
 assert.match(record,/hash/);
});
test("não aceita senha fraca, conhecida ou confirmação diferente",async()=>{
 const {lock}=auth();
 await assert.rejects(lock.setup("demo123","demo123"));
 await assert.rejects(lock.setup("abcdefghijk","abcdefghijk"),/letra e um número/);
 await assert.rejects(lock.setup("SenhaLocal2026","diferente"),/confirmação/);
 assert.equal(lock.configured(),false);
});
test("não sobrescreve senha já configurada por outra inscrição",async()=>{
 const {lock}=auth();
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026");
 await assert.rejects(lock.setup("OutraSenhaTeste2027","OutraSenhaTeste2027"),/já foi configurada/);
 assert.equal(await lock.verify("SenhaLocalTeste2026"),true);
 assert.equal(await lock.verify("OutraSenhaTeste2027"),false);
});
test("bloqueio por navegador é demonstrativo e não é autorização de servidor",()=>{
 const a=auth(),b=auth();
 assert.equal(a.lock.configured(),false);
 assert.equal(b.lock.configured(),false);
});

test("e-mail local é exigido junto da senha quando configurado",async()=>{
 const {lock,saved}=auth();
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026","Master@Example.COM");
 assert.equal(lock.getEmail(),"master@example.com");
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaLocalTeste2026"),true);
 assert.equal(await lock.verifyCredentials("outro@example.com","SenhaLocalTeste2026"),false);
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaIncorreta2026"),false);
 assert.equal(JSON.stringify([...saved.values()]).includes("SenhaLocalTeste2026"),false);
});
test("alteração de senha exige senha antiga e invalida a anterior",async()=>{
 const {lock}=auth();
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026","master@example.com");
 await assert.rejects(lock.changePassword("Errada","SenhaNova2026","SenhaNova2026"),/senha atual/);
 await assert.rejects(lock.changePassword("SenhaLocalTeste2026","SenhaNova2026","Outra2026"),/confirmação/);
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaLocalTeste2026"),true);
 await lock.changePassword("SenhaLocalTeste2026","SenhaNova2026","SenhaNova2026");
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaLocalTeste2026"),false);
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaNova2026"),true);
 assert.equal(lock.getEmail(),"master@example.com");
});
test("troca de e-mail local requer senha e mantém a senha existente",async()=>{
 const {lock}=auth();
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026","master@example.com");
 await assert.rejects(lock.changeEmail("Errada","novo@example.com"),/senha atual/);
 await assert.rejects(lock.changeEmail("SenhaLocalTeste2026","e-mail-invalido"),/e-mail válido/);
 await lock.changeEmail("SenhaLocalTeste2026"," Novo@Example.com ");
 assert.equal(lock.getEmail(),"novo@example.com");
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaLocalTeste2026"),false);
 assert.equal(await lock.verifyCredentials("novo@example.com","SenhaLocalTeste2026"),true);
});
test("senha antiga sem e-mail continua acessível e permite vincular e-mail depois",async()=>{
 const {lock}=auth();
 await lock.setup("SenhaLocalTeste2026","SenhaLocalTeste2026");
 assert.equal(lock.getEmail(),"");
 assert.equal(await lock.verifyCredentials("","SenhaLocalTeste2026"),true);
 await lock.changeEmail("SenhaLocalTeste2026","master@example.com");
 assert.equal(await lock.verifyCredentials("","SenhaLocalTeste2026"),false);
 assert.equal(await lock.verifyCredentials("master@example.com","SenhaLocalTeste2026"),true);
});
