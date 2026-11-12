import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const html=readFileSync(join(import.meta.dirname,"..","..","index.html"),"utf8");
test("V10 demonstração começa em 14/11/2026 09h Goiânia",()=>{
 assert.match(html,/2026-11-14T12:00:00\.000Z/);
 assert.match(html,/PeladaPro \| Simulação 14\/11/);
 assert.match(html,/const DBKEY='peladapro_demo_14nov2026_v1'/);
 assert.match(html,/capacity:20/);
 assert.match(html,/goalie_limit:2/);
});
test("Simulação não importa escalação de 07/11",()=>{
 assert.doesNotMatch(html,/orderedNames\.forEach\(name=>addDemoMember/);
 assert.doesNotMatch(html,/simulacao-0711-/);
 assert.match(html,/regs:\[\],interests:\[\]/);
});
test("Redefinição por código foi retirada dos painéis da demonstração",()=>{
 assert.doesNotMatch(html,/data-action="member-reset"/);
 assert.doesNotMatch(html,/data-action="admin-reset-member"/);
 assert.doesNotMatch(html,/function openMemberReset\(/);
});
test("Troca de formulário e fechamento protegem dados já preenchidos",()=>{
 assert.match(html,/function confirmMemberFormExit\(/);
 assert.match(html,/case 'member-create':if\(confirmMemberFormExit\(\)\)/);
 assert.match(html,/function closeModal\(force=false\)/);
 assert.match(html,/closeModal\(true\)/);
});
