import test from "node:test";
import assert from "node:assert/strict";
import handler from "../src/index.js";

const fake={DB:{},SITE_ORIGIN:"https://benitezfilho.github.io"};

test("health público da API",async()=>{
  const r=await handler.fetch(new Request("https://api.test/health"),fake);
  assert.equal(r.status,200);
  assert.equal((await r.json()).registration_enabled,false);
});
test("nega cadastro público sem identidade verificada",async()=>{
  const r=await handler.fetch(new Request("https://api.test/api/member/register",{method:"POST"}),fake);
  assert.equal(r.status,503);
});
test("admin negado sem sessão Cloudflare Access",async()=>{
  const r=await handler.fetch(new Request("https://api.test/api/admin/matches",{method:"POST",body:"{}"}),fake);
  assert.equal(r.status,403);
});
test("nega origem estranha",async()=>{
  const r=await handler.fetch(new Request("https://api.test/health",{headers:{"Origin":"https://site-malicioso.test"}}),fake);
  assert.equal(r.status,403);
});
test("API não retorna dados pessoais pela health",async()=>{
  const r=await handler.fetch(new Request("https://api.test/health"),fake);
  const data=await r.json();
  assert.equal(data.members,undefined);
});

test("nega identidade que não é a do Master",async()=>{
  const env={...fake,MASTER_EMAIL:"master@example.test",MASTER_API_KEY:"x".repeat(50)};
  const ctx={access:{getIdentity:async()=>({email:"outro@example.test"})}};
  const r=await handler.fetch(new Request("https://api.test/api/admin/matches",{method:"POST",body:"{}"}),env,ctx);
  assert.equal(r.status,403);
});
test("nega Master sem credencial do servidor mesmo com email Access",async()=>{
  const env={...fake,MASTER_EMAIL:"master@example.test"};
  const ctx={access:{getIdentity:async()=>({email:"master@example.test"})}};
  const r=await handler.fetch(new Request("https://api.test/api/admin/matches",{method:"POST",body:"{}"}),env,ctx);
  assert.equal(r.status,503);
});
