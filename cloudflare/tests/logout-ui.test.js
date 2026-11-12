import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const base=join(import.meta.dirname,"..","..");
const read=file=>readFileSync(join(base,file),"utf8");
test("V10: botão Sair disponível no cabeçalho de cada portal após login",()=>{
 const js=read("peladapro/assets/portal.js");
 assert.match(js,/document\.querySelectorAll\("\[data-header-logout\]"\)/);
 assert.match(js,/button\.hidden=!account/);
 assert.match(js,/\/api\/auth\/logout/);
 assert.match(js,/clearToken\(\);show\(null\)/);
 for(const role of ["jogador","admin","master"]){
  const html=read("peladapro/"+role+"/index.html");
  assert.match(html,/data-header-logout hidden/);
  assert.match(html,/data-logout/);
 }
});
test("Demonstração: logout visível apenas quando existe sessão",()=>{
 const html=read("index.html");
 assert.match(html,/id="member-global-logout"/);
 assert.match(html,/id="master-global-logout"/);
 assert.match(html,/member\.hidden=!Boolean\(state\.member\)/);
 assert.match(html,/master\.hidden=!Boolean\(state\.admin\)/);
 assert.match(html,/case 'member-logout':showLogoutDialog\('member'\)/);
 assert.match(html,/case 'logout':showLogoutDialog\('master'\)/);
 assert.match(html,/await api\('\/api\/member\/logout'/);
 assert.match(html,/await api\('\/api\/admin\/logout'/);
});
