import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const base=join(import.meta.dirname,"..","..","peladapro");
function file(path){return readFileSync(join(base,path),"utf8")}
test("PeladaPro possui três caminhos separados",()=>{
 const landing=file("index.html");
 for(const path of ["jogador/","admin/","master/"])assert.ok(landing.includes('href="'+path+'"'));
 for(const role of ["jogador","admin","master"])assert.match(file(role+"/index.html"),new RegExp('data-portal="(member|admin|master)"'));
});
test("Cada portal tem layout compartilhado sem inserir segredos no HTML",()=>{
 for(const role of ["jogador","admin","master"]){
  const html=file(role+"/index.html");
  assert.match(html,/assets\/styles\.css/);
  assert.match(html,/assets\/portal\.js/);
  assert.doesNotMatch(html,/Bearer [a-f0-9]{32,}/);
 }
});
test("Portais não apresentam botões que prometem operações administrativas ainda indisponíveis",()=>{
 for(const role of ["admin","master"]){
  const html=file(role+"/index.html");
  assert.match(html,/ainda não|ainda não estão|indisponíveis/);
  assert.doesNotMatch(html,/data-action="(confirm-payment|reset-password|create-user)"/);
 }
});
test("Sessão é checada no servidor e por papel e o logout revoga token",()=>{
 const js=file("assets/portal.js");
 assert.match(js,/\/api\/auth\/me/);
 assert.match(js,/account\.role===role/);
 assert.match(js,/\/api\/auth\/logout/);
 assert.match(js,/sessionStorage\.removeItem/);
 assert.doesNotMatch(js,/MASTER_API_KEY\s*[:=]/);
});
