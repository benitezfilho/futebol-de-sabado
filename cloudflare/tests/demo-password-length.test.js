import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const base=join(import.meta.dirname,"..","..");
const file=(p)=>readFileSync(join(base,p),"utf8");
test("Demonstração V10 aceita mínimo de 3 caracteres para senha",()=>{
 const html=file("index.html");
 const accounts=file("features-member-accounts.js");
 const master=file("features-demo-auth.js");
 assert.match(html,/Criar senha \(mínimo 3 caracteres, somente demonstração\)/);
 assert.match(html,/name="password" minlength="3" maxlength="128"/);
 assert.match(html,/name="confirm_password" minlength="3" maxlength="128"/);
 assert.match(accounts,/p\.length<3\|\|p\.length>128/);
 assert.match(master,/const MIN=3,ITERATIONS=250000/);
});
test("A autenticação real D1 mantém mínimo forte",()=>{
 const auth=file("cloudflare/src/auth.js");
 assert.match(auth,/p\.length<12/);
});
