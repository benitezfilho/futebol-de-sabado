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
test("admin desativado enquanto MASTER_API_KEY não existe",async()=>{
  const r=await handler.fetch(new Request("https://api.test/api/admin/matches",{method:"POST",body:"{}"}),fake);
  assert.equal(r.status,503);
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
