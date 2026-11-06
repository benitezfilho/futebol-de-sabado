/* Bloqueio LOCAL para a demonstração, não autenticação de servidor.
 * Não utilize para dados pessoais reais. Acesso de produção requer backend e MFA.
 */
(function(){
"use strict";
const KEY="futebol_demo_admin_lock_v1";
const MIN=10,ITERATIONS=250000;
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
async function setup(password,confirm){
 if(configured())throw new Error("A senha desta demonstração já foi configurada neste navegador.");
 if(password!==confirm)throw new Error("A confirmação não corresponde à senha.");
 if(typeof password!=="string"||password.length<MIN || password.length>128)
   throw new Error("Use uma senha de 10 a 128 caracteres.");
 if(!/[a-zA-ZÀ-ÿ]/.test(password)||!/\d/.test(password))
   throw new Error("Inclua pelo menos uma letra e um número.");
 if(/^(demo123|1234567890|admin123456|password123)$/i.test(password))
   throw new Error("Essa senha de teste é conhecida. Escolha outra.");
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await derive(password,salt);
 const record={version:1,salt:hex(salt),hash:hex(hash),iterations:ITERATIONS};
 try{localStorage.setItem(KEY,JSON.stringify(record))}
 catch{throw new Error("Não foi possível salvar o bloqueio neste navegador.");}
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
window.FUTEBOL_demoAuth=Object.freeze({configured,setup,verify});
})();