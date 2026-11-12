/* Bloqueio LOCAL para a demonstração, não autenticação de servidor.
 * Não utilize para dados pessoais reais. Acesso de produção requer backend e MFA.
 */
(function(){
"use strict";
const KEY="futebol_demo_admin_lock_v1";
const MIN=3,ITERATIONS=250000;
function read(){
  try{const record=JSON.parse(localStorage.getItem(KEY)||"null");
    return record && record.version===1 && typeof record.salt==="string" && typeof record.hash==="string"?record:null;
  }catch{return null}
}
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("")}
function fromHex(value){
 if(!/^(?:[0-9a-f]{2})+$/i.test(value))throw new Error("Registro de autenticação inválido.");
 return Uint8Array.from(value.match(/.{2}/g),x=>parseInt(x,16));
}
async function derive(password,salt,rounds=ITERATIONS){
 if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw new Error("Navegador sem criptografia segura. Use Chrome ou Safari atualizado.");
 const raw=new TextEncoder().encode(password);
 const key=await crypto.subtle.importKey("raw",raw,"PBKDF2",false,["deriveBits"]);
 return new Uint8Array(await crypto.subtle.deriveBits(
   {name:"PBKDF2",salt,iterations:rounds,hash:"SHA-256"},key,256));
}
function configured(){return Boolean(read())}
function getEmail(){return String(read()?.email||"")}
function normalizedEmail(email){
 const result=String(email||"").trim().toLowerCase();
 if(result.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
   throw new Error("Informe um endereço de e-mail válido.");
 return result;
}
function checkPassword(password,confirmation){
 if(password!==confirmation)throw new Error("A confirmação não corresponde à senha.");
 if(typeof password!=="string"||password.length<MIN || password.length>128)
   throw new Error("Use uma senha de 3 a 128 caracteres na demonstração.");
 if(/^(demo123|1234567890|admin123456|password123)$/i.test(password))
   throw new Error("Essa senha de teste é conhecida. Escolha outra.");
}
function write(record){
 try{localStorage.setItem(KEY,JSON.stringify(record))}
 catch{throw new Error("Não foi possível salvar as configurações neste navegador.");}
}
async function setup(password,confirm,email=null){
 if(configured())throw new Error("A senha desta demonstração já foi configurada neste navegador.");
 checkPassword(password,confirm);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await derive(password,salt);
 const record={version:1,salt:hex(salt),hash:hex(hash),iterations:ITERATIONS,
  email:email===null?"":normalizedEmail(email)};
 write(record);
 return true;
}
async function verify(password){
 const record=read();
 if(!record)return false;
 const hash=await derive(String(password||""),fromHex(record.salt),record.iterations);
 const expected=fromHex(record.hash);
 if(hash.length!==expected.length)return false;
 let diff=0;
 for(let i=0;i<hash.length;i++)diff|=hash[i]^expected[i];
 return diff===0;
}
async function verifyCredentials(email,password){
 const saved=read();
 if(!saved)return false;
 if(saved.email && saved.email!==String(email||"").trim().toLowerCase())return false;
 return verify(password);
}
async function changePassword(currentPassword,newPassword,confirmation){
 if(!await verify(currentPassword))throw new Error("A senha atual está incorreta.");
 checkPassword(newPassword,confirmation);
 if(newPassword===currentPassword)throw new Error("Escolha uma senha diferente da atual.");
 const saved=read(),salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await derive(newPassword,salt);
 write({...saved,salt:hex(salt),hash:hex(hash),iterations:ITERATIONS});
 return true;
}
async function changeEmail(currentPassword,newEmail){
 if(!await verify(currentPassword))throw new Error("A senha atual está incorreta.");
 const saved=read();
 write({...saved,email:normalizedEmail(newEmail)});
 return true;
}
window.FUTEBOL_demoAuth=Object.freeze({
 configured,setup,verify,getEmail,verifyCredentials,changePassword,changeEmail
});
})();