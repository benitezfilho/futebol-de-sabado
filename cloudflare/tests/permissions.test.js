import test from "node:test";
import assert from "node:assert/strict";
import {hasPermission,authorize,ROLES} from "../src/permissions.js";
import {portalRoute} from "../src/auth.js";
const request=(path,method="GET",token)=>new Request("https://api.example"+path,{method,headers:token?{Authorization:"Bearer "+token}:{}});
const denyDb={prepare(){throw Error("Não deveria consultar D1")}};
test("três perfis declarados e exclusivos",()=>{
 assert.deepEqual(ROLES,["member","admin","master"]);
 assert.equal(hasPermission("member","account:self"),true);
 assert.equal(hasPermission("member","operations:read"),false);
 assert.equal(hasPermission("member","security:read"),false);
 assert.equal(hasPermission("admin","operations:read"),true);
 assert.equal(hasPermission("admin","security:read"),false);
 assert.equal(hasPermission("master","security:read"),true);
 assert.equal(hasPermission("__proto__","security:read"),false);
});
test("autorizações negam usuário ausente, inativo e perfil insuficiente",()=>{
 assert.equal(authorize(null,"security:read").status,401);
 assert.equal(authorize({role:"master",active:false},"security:read").status,403);
 assert.equal(authorize({role:"member",active:true},"operations:read").status,403);
 assert.equal(authorize({role:"admin",active:true},"security:read").status,403);
 assert.equal(authorize({role:"master",active:true},"security:read").ok,true);
});
test("API dos três portais rejeita sessões inexistentes",async()=>{
 for(const area of ["player","admin","master"]){
  const result=await portalRoute(request("/api/portal/"+area),denyDb,"/api/portal/"+area,{}, {});
  assert.equal(result.status,401,area);
 }
});
test("API de painéis não expõe rotas de escrita durante homologação",async()=>{
 const result=await portalRoute(request("/api/portal/admin","POST"),denyDb,"/api/portal/admin",{}, {});
 assert.equal(result.status,404);
});
