import test from "node:test";
import assert from "node:assert/strict";
import { authRoute, masterAccountRoute } from "../src/auth.js";

const req=(path,method="GET",body=null,headers={})=>new Request("https://api.example"+path,{method,headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
const denyDb={prepare(){throw Error("Consulta ao D1 inesperada")}};
test("V10: rota autenticada não consulta D1 sem bearer token",async()=>{
 const r=await authRoute(req("/api/auth/me"),denyDb,"/api/auth/me");
 assert.equal(r.status,401);
});
test("V10: logout não aceita sessão inexistente",async()=>{
 const r=await authRoute(req("/api/auth/logout","POST"),denyDb,"/api/auth/logout");
 assert.equal(r.status,401);
});
test("V10: cadastro Master rejeita perfil master na API",async()=>{
 const r=await masterAccountRoute(req("/api/admin/accounts","POST",{email:"x@example.com",role:"master",password:"Senha123456789"}),denyDb,"/api/admin/accounts");
 assert.equal(r.status,400);
});
test("V10: login rejeita e-mail inválido",async()=>{
 const r=await authRoute(req("/api/auth/login","POST",{email:"invalido",password:"senha"}),denyDb,"/api/auth/login");
 assert.equal(r.status,401);
});
test("V10: rotas desconhecidas não concedem acesso",async()=>{
 const r=await authRoute(req("/api/auth/admin","POST"),denyDb,"/api/auth/admin");
 assert.equal(r.status,401);
});
