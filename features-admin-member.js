/* Cadastro manual, exclusivo da demonstração Master.
 * Guarda os dados somente no navegador. Produção exige API autenticada, D1 e consentimento.
 */
(function(){
"use strict";
if(typeof DEMO==="undefined"||typeof saveDemo!=="function")return;
function normalize(data){
 const name=String(data.name||"").trim().replace(/\s+/g," ");
 const email=String(data.email||"").trim().toLowerCase();
 let phone=String(data.phone||"").replace(/\D/g,"");
 if(phone.length===13&&phone.startsWith("55"))phone=phone.slice(2);
 const role=String(data.role||"linha");
 const position=String(data.position||"indefinido");
 if(name.length<5||name.length>100||name.split(" ").length<2)throw Error("Informe nome completo com sobrenome (5 a 100 caracteres).");
 if(email.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Informe um e-mail válido.");
 if(phone.length!==11||phone[2]!=="9"||Number(phone.slice(0,2))<11)throw Error("Informe celular com DDD: (62) 99999-9999.");
 if(!["linha","goleiro"].includes(role))throw Error("Tipo de jogador inválido.");
 if(role==="linha"&&position==="goleiro")throw Error("Selecione uma posição de linha.");
 return {name,email,phone,role,position:role==="goleiro"?"goleiro":position};
}
function add(values){
 if(!DEMO.adminLogged)throw Error("Somente Admin Master pode incluir jogadores manualmente.");
 const input=normalize(values);
 const existing=DEMO.members.find(m=>m.phone===input.phone||String(m.email||"").trim().toLowerCase()===input.email);
 if(existing)throw Error("Telefone ou e-mail já cadastrado. Utilize o membro existente; não crie outra conta.");
 const memberId=Math.max(0,...DEMO.members.map(x=>Number(x.id)||0))+1;
 const timestamp=new Date().toISOString();
 const member={id:memberId,name:input.name,phone:input.phone,email:input.email,
  active:true,verified_at:null,whatsapp_opt_in:false,
  admin_created:true,admin_created_at:timestamp,registration_source:"master_manual"};
 let detail="Membro cadastrado manualmente, sem verificação do celular";
 let status=null,regId=null;
 const matchId=Number(values.match_id)||0;
 const m=matchId?DEMO.matches.find(x=>x.id===matchId):null;
 if(matchId&&(!m||m.deleted_at||m.status!=="active"))throw Error("A partida selecionada não está ativa.");
 DEMO.members.push(member);
 if(m){
  const entries=DEMO.regs.filter(x=>x.match_id===matchId);
  const occupancy=entries.filter(x=>x.role===input.role&&["paid","reserved"].includes(x.status)).length;
  const paid=entries.filter(x=>x.role==="linha"&&x.status==="paid").length;
  const limit=input.role==="goleiro"?m.goalie_limit:m.capacity;
  if(input.role==="linha"&&paid>=m.capacity){
   status="interest";
   DEMO.interests.push({id:Date.now()+Math.random(),member_id:memberId,match_id:matchId,
    created_at:timestamp,source:"master_manual",note:"Cadastro de interesse sem vaga; lotação paga"});
   detail="Interessado cadastrado sem vaga (22 pagantes ou capacidade configurada)";
  }else{
   status=occupancy>=limit?"waitlist":"reserved";
   regId=Math.max(0,...DEMO.regs.map(x=>Number(x.id)||0))+1;
   const due=status==="reserved"&&input.role==="linha"?new Date(Date.now()+30*60000).toISOString():null;
   DEMO.regs.push({
    id:regId,token:"master-manual-"+memberId+"-"+Date.now(),match_id:matchId,member_id:memberId,
    name:member.name,email:member.email,phone:member.phone,
    role:input.role,position:input.position,status,
    created_at:timestamp,paid_at:null,reserved_until:due,
    queue_hold:status==="waitlist"?1:0,
    queue_entered_at:status==="waitlist"?timestamp:null,
    attended:0,pix_code:null,pix_qr_image:null,source:"master_manual",
    review_reason:"Adicionado manualmente pelo Admin Master. Contato não verificado."
   });
   detail=status==="reserved"?input.role==="goleiro"?
     "Goleiro cadastrado, aguardando aprovação do Master":"Jogador cadastrado e aguardando confirmação manual do Pix (30 minutos)":
     "Jogador cadastrado na lista de espera manual (sem prioridade automática)";
  }
 }
 window.FUTEBOL_record_event?.("MEMBRO_ADICIONADO_MASTER",matchId||null,regId,
   member.name+" | "+detail);
 saveDemo();
 return {id:member.id,registration_id:regId,status,message:detail};
}
window.FUTEBOL_adminMember={normalize,add};
})();