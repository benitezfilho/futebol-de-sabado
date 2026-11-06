/* Contas de membros, APENAS DEMONSTRACAO LOCAL.
 * Em producao o hash, o reset e as sessoes precisam ficar no servidor.
 * O SMS desta demonstracao nao verifica posse de um numero verdadeiro.
 */
(function(){
"use strict";
if(typeof DEMO==="undefined"||typeof saveDemo!=="function")return;
const KEY="futebol_demo_member_passwords_v1",ROUNDS=220000;
const normalEmail=s=>String(s||"").trim().toLowerCase();
function validEmail(value){
 const s=normalEmail(value);
 if(s.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Error("Informe um e-mail válido.");
 return s;
}
function validate(password,confirmation){
 if(String(password)!==String(confirmation))throw Error("A confirmação não corresponde à nova senha.");
 if(typeof password!=="string"||password.length<10||password.length>128||
    !/[a-zA-ZÀ-ÿ]/.test(password)||!/\d/.test(password))
   throw Error("A senha deve ter de 10 a 128 caracteres, pelo menos uma letra e um número.");
 if(/^(demo123|1234567890|admin123456|password123)$/i.test(password))throw Error("Escolha uma senha que não seja de demonstração conhecida.");
}
function state(){
 let stored=null;
 try{stored=JSON.parse(localStorage.getItem(KEY)||"null")}catch{}
 if(!stored || stored.version!==1 || typeof stored.users!=="object" || !stored.users)
    stored={version:1,users:{},resets:{}};
 stored.resets??={};
 return stored;
}
function write(data){
 try{localStorage.setItem(KEY,JSON.stringify(data))}
 catch{throw Error("Não foi possível salvar a senha neste navegador.");}
}
function bytesHex(u){return Array.from(u,b=>b.toString(16).padStart(2,"0")).join("")}
function decodeHex(s){
 if(typeof s!=="string"|| !/^(?:[0-9a-f]{2})+$/i.test(s))throw Error("Registro de senha inválido.");
 return Uint8Array.from(s.match(/.{2}/g),x=>parseInt(x,16));
}
async function hashPassword(password,salt,rounds=ROUNDS){
 if(!crypto?.subtle||!crypto?.getRandomValues)throw Error("Navegador sem criptografia segura.");
 const raw=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:rounds,hash:"SHA-256"},raw,256);
 return new Uint8Array(bits);
}
async function verify(password,record){
 if(!record||!record.salt||!record.hash)return false;
 const digest=await hashPassword(String(password||""),decodeHex(record.salt),record.rounds||ROUNDS);
 const expected=decodeHex(record.hash);
 if(digest.length!==expected.length)return false;
 let result=0;for(let i=0;i<digest.length;i++)result|=digest[i]^expected[i];
 return result===0;
}
function activeMember(){
 const member=DEMO.members.find(m=>m.id===DEMO.memberLogged && m.active);
 if(!member)throw Error("Entre como membro para gerenciar sua conta.");
 return member;
}
function accountStatus(id){
 const m=DEMO.members.find(x=>String(x.id)===String(id));
 if(!m)return null;
 const info=state();
 return {id:m.id,name:m.name,email:m.email,
   has_password:Boolean(info.users[m.id]),
   reset_pending:Boolean(info.resets[m.id]),
   active:!!m.active,
   verified_phone:Boolean(m.verified_at)};
}
function myStatus(){
 return accountStatus(activeMember().id);
}
async function saveMyPassword(oldPassword,newPassword,confirm){
 const m=activeMember(),s=state(),previous=s.users[m.id];
 validate(newPassword,confirm);
 if(previous){
   if(!await verify(oldPassword,previous))throw Error("Senha atual incorreta.");
   if(await verify(newPassword,previous))throw Error("A nova senha deve ser diferente da anterior.");
 }else if(!m.verified_at){
   // Cadastro feito manualmente pelo Master precisa validar o telefone antes de definir senha.
   throw Error("Antes de definir uma senha, faça login com o código de verificação do celular.");
 }
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const value=await hashPassword(newPassword,salt);
 s.users[m.id]={hash:bytesHex(value),salt:bytesHex(salt),rounds:ROUNDS,updated_at:new Date().toISOString()};
 delete s.resets[m.id];
 write(s);
 window.FUTEBOL_record_event?.("SENHA_MEMBRO_ATUALIZADA",null,null,
  "Conta "+m.id+" atualizou a credencial local");
 saveDemo();
 return accountStatus(m.id);
}
async function signIn(email,password){
 const identity=validEmail(email);
 const member=DEMO.members.find(x=>normalEmail(x.email)===identity);
 const saved=state(),record=member?saved.users[member.id]:null;
 // Resposta genérica para não expor existência de cadastro.
 if(!member||!member.active||saved.resets[member.id]||!await verify(password,record))
   throw Error("E-mail ou senha inválidos, ou redefinição pendente. Utilize o acesso por celular, se necessário.");
 DEMO.memberLogged=member.id;
 saveDemo();
 return member;
}
function adminReset(id){
 if(!DEMO.adminLogged)throw Error("Somente o Admin Master pode solicitar redefinição.");
 const member=DEMO.members.find(x=>String(x.id)===String(id));
 if(!member)throw Error("Membro não encontrado.");
 const s=state();
 delete s.users[member.id];
 s.resets[member.id]=new Date().toISOString();
 write(s);
 if(DEMO.memberLogged===member.id)DEMO.memberLogged=null;
 window.FUTEBOL_record_event?.("RESET_SENHA_SOLICITADO",null,null,"Reset local para conta "+member.id);
 saveDemo();
 return accountStatus(member.id);
}
function adminDirectory(){
 if(!DEMO.adminLogged)throw Error("Somente o Admin Master pode consultar usuários.");
 return DEMO.members.map(m=>accountStatus(m.id));
}
window.FUTEBOL_memberAccounts=Object.freeze({
 status:myStatus,byId:accountStatus,adminDirectory,savePassword:saveMyPassword,
 signIn,adminReset
});
})();