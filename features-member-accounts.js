/* Futebol de Sábado: contas de DEMONSTRAÇÃO, armazenadas só neste navegador.
 * SMS desativado. Senhas nunca são reveladas. Produção exigirá backend/identidade.
 */
(function(){
 "use strict";
 if(typeof DEMO==="undefined"||typeof saveDemo!=="function")return;
 const KEY="futebol_demo_member_passwords_v1",ROUNDS=220000,RESET_LIFE=60*60*1000;
 const norm=s=>String(s||"").trim().toLowerCase();
 const now=()=>new Date().toISOString();
 const validEmail=e=>{
  const val=norm(e);
  if(val.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))throw Error("Informe um e-mail válido.");
  return val;
 };
 const validPhone=p=>{
  let s=String(p||"").replace(/\D/g,"");if(s.length===13&&s.startsWith("55"))s=s.slice(2);
  if(!/^\d{11}$/.test(s)||s[2]!=="9"||Number(s.slice(0,2))<11)throw Error("Informe celular com DDD, por exemplo (62) 99999-1234.");
  return s;
 };
 function validPassword(value,confirmation){
  const p=String(value||"");
  if(p!==String(confirmation||""))throw Error("A confirmação não corresponde à nova senha.");
  if(p.length<10||p.length>128||!/[a-zA-ZÀ-ÿ]/.test(p)||!/\d/.test(p))throw Error("Use de 10 a 128 caracteres, com letra e número.");
  if(/^(demo123|1234567890|admin123456|password123)$/i.test(p))throw Error("Não utilize uma senha comum de demonstração.");
 }
 function load(){
  let s=null;try{s=JSON.parse(localStorage.getItem(KEY)||"null")}catch{}
  if(!s||s.version!==1||!s.users||typeof s.users!=="object")s={version:1,users:{},resets:{}};
  s.resets??={};return s;
 }
 function persist(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{throw Error("Não foi possível salvar os dados locais neste navegador.");}}
 const hex=arr=>Array.from(arr,b=>b.toString(16).padStart(2,"0")).join("");
 const fromHex=value=>{
  if(typeof value!=="string"||!/^(?:[0-9a-f]{2})+$/i.test(value))throw Error("Registro de credencial inválido.");
  return Uint8Array.from(value.match(/.{2}/g),c=>parseInt(c,16));
 };
 async function digest(password,salt,rounds=ROUNDS){
  if(!crypto?.subtle||!crypto?.getRandomValues)throw Error("Use um navegador atualizado em HTTPS.");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(password)),"PBKDF2",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:rounds,hash:"SHA-256"},key,256));
 }
 async function newRecord(password){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  return {salt:hex(salt),hash:hex(await digest(password,salt)),rounds:ROUNDS,updated_at:now()};
 }
 async function verify(password,record){
  if(!record?.salt||!record?.hash)return false;
  const actual=await digest(password,fromHex(record.salt),record.rounds||ROUNDS),expected=fromHex(record.hash);
  if(actual.length!==expected.length)return false;
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];return diff===0;
 }
 // Bloqueia sessões legadas iniciadas pelo antigo SMS simulado sem senha cadastrada.
 if(DEMO.memberLogged && !load().users[DEMO.memberLogged]){
  DEMO.memberLogged=null;
  saveDemo();
 }
  function memberById(id){return DEMO.members.find(x=>String(x.id)===String(id))}
 function current(){
  const m=memberById(DEMO.memberLogged);
  if(!m||!m.active)throw Error("Entre com e-mail e senha para acessar a conta.");
  return m;
 }
 function status(id){
  const m=memberById(id);if(!m)return null;
  const s=load();
  return {id:m.id,name:m.name,email:m.email,phone:m.phone,
   active:!!m.active,has_password:!!s.users[m.id],reset_pending:!!s.resets[m.id],
   admin_created:!!m.admin_created};
 }
 function log(action,id){window.FUTEBOL_record_event?.(action,null,null,"Conta de membro "+id);}
 async function signup({name,email,phone,password,confirmation}){
  const full=String(name||"").trim().replace(/\s+/g," ");
  if(full.length<5||full.length>100||full.split(" ").length<2)throw Error("Informe nome e sobrenome.");
  const em=validEmail(email),tel=validPhone(phone);
  validPassword(password,confirmation);
  if(DEMO.members.some(m=>norm(m.email)===em||String(m.phone||"").replace(/\D/g,"")===tel))
   throw Error("E-mail ou telefone já cadastrado. Solicite orientação ao Admin Master se precisar recuperar o acesso.");
  const id=Math.max(0,...DEMO.members.map(m=>Number(m.id)||0))+1;
  const record=await newRecord(password),s=load(),ts=now();
  s.users[id]=record;persist(s);
  const member={id,name:full,email:em,phone:tel,active:true,verified_at:null,whatsapp_opt_in:false,
   registration_source:"member_demo_email",created_at:ts};
  DEMO.members.push(member);DEMO.memberLogged=id;log("MEMBRO_CADASTRADO_EMAIL",id);saveDemo();
  return member;
 }
 async function signIn(email,password){
  const em=validEmail(email);
  const member=DEMO.members.find(m=>norm(m.email)===em),s=load();
  if(!member||!member.active||s.resets[member.id]||!await verify(password,s.users[member.id]))
   throw Error("E-mail ou senha inválidos, ou redefinição pendente.");
  DEMO.memberLogged=member.id;saveDemo();return member;
 }
 async function changeMyPassword(oldPassword,newPassword,confirmation){
  const member=current(),s=load(),previous=s.users[member.id];
  if(!previous||s.resets[member.id])throw Error("Use um código de redefinição emitido pelo Master para criar sua senha.");
  validPassword(newPassword,confirmation);
  if(!await verify(oldPassword,previous))throw Error("Senha atual incorreta.");
  if(await verify(newPassword,previous))throw Error("Escolha uma senha diferente da anterior.");
  s.users[member.id]=await newRecord(newPassword);persist(s);
  log("SENHA_MEMBRO_ATUALIZADA",member.id);return status(member.id);
 }
 function directory(){
  if(!DEMO.adminLogged)throw Error("Somente o Admin Master pode consultar as contas.");
  return DEMO.members.map(m=>status(m.id));
 }
 async function adminReset(id){
  if(!DEMO.adminLogged)throw Error("Somente o Admin Master pode redefinir contas.");
  const m=memberById(id);if(!m)throw Error("Membro não encontrado.");
  const s=load(),code=hex(crypto.getRandomValues(new Uint8Array(12))).toUpperCase();
  const record=await newRecord(code),expires_at=new Date(Date.now()+RESET_LIFE).toISOString();
  delete s.users[m.id];
  s.resets[m.id]={...record,expires_at,attempts:0};
  persist(s);
  if(String(DEMO.memberLogged)===String(m.id))DEMO.memberLogged=null;
  log("RESET_MEMBRO_GERADO",m.id);saveDemo();
  return {member:status(m.id),code,expires_at};
 }
 async function redeemReset(email,code,password,confirmation){
  const em=validEmail(email),m=DEMO.members.find(x=>norm(x.email)===em),s=load();
  const pending=m&&s.resets[m.id];
  if(!m||!m.active||!pending)throw Error("Código inválido ou expirado. Solicite outro ao administrador.");
  if(Date.now()>Date.parse(pending.expires_at))throw Error("Código expirado. Solicite outro ao administrador.");
  if(pending.attempts>=5)throw Error("Limite de tentativas atingido. Solicite outro código.");
  const correct=await verify(String(code||"").trim().toUpperCase(),pending);
  if(!correct){
   pending.attempts++;persist(s);
   throw Error("Código inválido. Verifique com o administrador.");
  }
  validPassword(password,confirmation);
  s.users[m.id]=await newRecord(password);
  delete s.resets[m.id];
  persist(s);
  DEMO.memberLogged=m.id;log("RESET_MEMBRO_CONCLUIDO",m.id);saveDemo();
  return m;
 }
 window.FUTEBOL_memberAccounts=Object.freeze({
  status:()=>status(current().id),directory,signup,signIn,changeMyPassword,adminReset,redeemReset
 });
})();