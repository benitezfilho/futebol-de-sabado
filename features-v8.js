/* Futebol de Sábado V8: melhorias da demonstração.
 * Dados e fotos ficam apenas no localStorage deste navegador, SEM servidor real.
 */
(function () {
  "use strict";
  if (typeof DEMO === "undefined" || typeof saveDemo !== "function") return;

  const positions = [
    ["indefinido","Sem preferência"],
    ["atacante","Atacante"],
    ["centroavante","Centroavante"],
    ["ponta_direita","Ponta direita"],
    ["ponta_esquerda","Ponta esquerda"],
    ["meia","Meia"],
    ["meia_atacante","Meia-atacante"],
    ["volante","Volante"],
    ["zagueiro","Zagueiro"],
    ["lateral_direito","Lateral direito"],
    ["lateral_esquerdo","Lateral esquerdo"],
    ["ala","Ala"],
    ["coringa","Coringa (linha)"],
    ["goleiro","Goleiro (isento, sujeito à aprovação)"]
  ];
  window.FUTEBOL_POSITIONS_V8=positions;
  DEMO.events=Array.isArray(DEMO.events)?DEMO.events:[];
  DEMO.rotation=DEMO.rotation||{};
  DEMO.bench=DEMO.bench||{};
  DEMO.teams=DEMO.teams||[];
  for (const m of DEMO.members) m.photo_data ||= null;

  const originalSave=saveDemo;
  const fingerprint = () => ({
    regs: new Map(DEMO.regs.map(r=>[r.id,{status:r.status,attended:r.attended,paid_at:r.paid_at,name:r.name}])),
    interests: new Set(DEMO.interests.map(x=>x.id)),
    matches: new Map(DEMO.matches.map(m=>[m.id,JSON.stringify([m.title,m.venue,m.capacity,m.starts_at,m.opens_at,m.payment_deadline,m.signup_closes_at])])),
    photos:new Map(DEMO.members.map(m=>[m.id,Boolean(m.photo_data)]))
  });
  let previous=fingerprint();
  function record(action,matchId,registrationId,description){
    DEMO.events.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Math.random()),action,
      match_id:matchId||null,registration_id:registrationId||null,
      detail:String(description||""),at:new Date().toISOString()});
    DEMO.events=DEMO.events.slice(0,800);
  }
  window.FUTEBOL_record_event=record;
  saveDemo=function(){
    const next=fingerprint();
    for(const r of DEMO.regs){
      const before=previous.regs.get(r.id);
      if(!before) record("INSCRICAO",r.match_id,r.id,r.name+" entrou: "+r.status);
      else {
        if(before.status!==r.status)record(
          r.status==="paid"?"PAGAMENTO_CONFIRMADO":r.status==="reserved"?"CONVOCADO":
          r.status==="waitlist"?"LISTA_ESPERA":r.status==="expired"?"PRAZO_EXPIRADO":
          r.status==="cancelled"?"CANCELADO":"STATUS_ALTERADO",
          r.match_id,r.id,r.name+": "+before.status+" → "+r.status);
        if(before.attended!==r.attended)record("PRESENCA",r.match_id,r.id,r.name+": presença "+(r.attended?"marcada":"desmarcada"));
        if(before.paid_at!==r.paid_at && before.status===r.status && r.status==="paid") record("HORARIO_PIX_CORRIGIDO",r.match_id,r.id,r.name);
      }
    }
    for(const i of DEMO.interests) if(!previous.interests.has(i.id))
      record("INTERESSE_HISTORICO",i.match_id,null,"Membro "+i.member_id+" manifestou interesse sem reserva de vaga");
    for(const m of DEMO.matches)
      if(previous.matches.has(m.id) && previous.matches.get(m.id)!==next.matches.get(m.id))record("PARTIDA_EDITADA",m.id,null,m.title);
    for(const member of DEMO.members)
      if(previous.photos.get(member.id)!==Boolean(member.photo_data))record("FOTO_PERFIL",null,null,"Membro "+member.id+" atualizou foto local");

    const beforeNotices=DEMO.notices.length;
    // Uma convocação só é ativa enquanto a reserva está aguardando decisão.
    DEMO.notices=DEMO.notices.filter(n=>{
      const r=DEMO.regs.find(x=>x.token===n.token && x.match_id===n.match_id);
      return r && r.status==="reserved";
    });
    if(beforeNotices>DEMO.notices.length) record("CONVOCACAO_FINALIZADA",null,null,
      (beforeNotices-DEMO.notices.length)+" aviso(s) removido(s) da aba ativa");

    previous=next;
    originalSave();
  };

  const originalFetch=window.fetch;
  const toJson=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json"}});
  const failure=(message,status=400)=>toJson({detail:message},status);
  function isMaster(){return !!DEMO.adminLogged;}
  function chooseShuffle(list){
    const result=[...list];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function lineOccupied(matchId) {
    return DEMO.regs.filter(r=>r.match_id===matchId&&r.role==="linha"&&["paid","reserved"].includes(r.status)).length;
  }

  window.fetch=async function(input,options={}){
    const path=String(input).split("?")[0],method=String(options.method||"GET").toUpperCase();
    let body={};try{body=options.body?JSON.parse(options.body):{}}catch{return failure("JSON inválido",400)}

    // Reabrir uma inscrição cancelada/expirada com proteção contra sobrelotação.
    const restore=path.match(/^\/api\/admin\/registrations\/(\d+)\/restore$/);
    if(restore && method==="POST"){
      if(!isMaster())return failure("Acesso Master necessário",401);
      const r=DEMO.regs.find(x=>x.id===Number(restore[1]));
      if(!r)return failure("Inscrição não encontrada",404);
      if(!["cancelled","expired"].includes(r.status))return failure("Só inscrições canceladas ou expiradas podem ser restauradas",409);
      const m=DEMO.matches.find(x=>x.id===r.match_id);
      if(!m || m.deleted_at)return failure("Partida inativa",409);
      const old=r.status, previousStatus=r.previous_status;
      if(previousStatus==="paid"){
        const occupied=r.role==="goleiro"?DEMO.regs.filter(x=>x.match_id===m.id&&x.role==="goleiro"&&["paid","reserved"].includes(x.status)).length:lineOccupied(m.id);
        const capacity=r.role==="goleiro"?m.goalie_limit:m.capacity;
        if(occupied>=capacity)return failure("Sem vaga para restaurar como pago. Ajuste a escalação manualmente antes.",409);
        r.status="paid";r.paid_at=r.previous_paid_at||r.paid_at||new Date().toISOString();r.reserved_until=null;
      }else if(r.role==="goleiro"){
        const count=DEMO.regs.filter(x=>x.match_id===m.id&&x.role==="goleiro"&&["paid","reserved"].includes(x.status)).length;
        r.status=count<m.goalie_limit?"reserved":"waitlist";r.reserved_until=null;
      }else{
        r.status="waitlist";r.reserved_until=null;r.queue_hold=0;r.queue_entered_at=new Date().toISOString();
      }
      record("INSCRICAO_RESTAURADA",m.id,r.id,r.name+": "+old+" → "+r.status);
      saveDemo();return toJson({ok:true,status:r.status});
    }

    // Time: exatamente 5 na linha. Goleiros fixos não entram no sorteio.
    const draw=path.match(/^\/api\/admin\/matches\/(\d+)\/draw$/);
    if(draw && method==="POST"){
      if(!isMaster())return failure("Acesso Master necessário",401);
      const matchId=Number(draw[1]),count=Number(body.team_count);
      if(!Number.isInteger(count)||count<2||count>8)return failure("Escolha de 2 a 8 times",422);
      const players=DEMO.regs.filter(r=>r.match_id===matchId && r.status==="paid"&&r.role==="linha")
        .sort((a,b)=>String(a.paid_at||"").localeCompare(String(b.paid_at||""))||a.id-b.id);
      if(players.length<count*5)return failure("São necessários "+(count*5)+" jogadores de linha pagos para formar "+count+" times completos.",422);
      const starters=chooseShuffle(players.slice(0,10));
      const others=chooseShuffle(players.slice(10));
      const groups=[];
      const labels=Array.from({length:count},(_,i)=>"Time "+String.fromCharCode(65+i));
      for(let i=0;i<count;i++){
        const selected=i<2?starters.slice(i*5,(i+1)*5):others.slice((i-2)*5,(i-1)*5);
        groups.push({match_id:matchId,label:labels[i],players:selected.map(r=>r.id),role:"linha"});
      }
      // Somente depois do sorteio, os outros jogadores vão para o banco.
      const used=new Set(groups.flatMap(x=>x.players));
      DEMO.bench[matchId]=players.filter(r=>!used.has(r.id)).map(r=>r.id);
      DEMO.teams=DEMO.teams.filter(t=>t.match_id!==matchId).concat(groups);
      DEMO.rotation[matchId]={playing:[labels[0],labels[1]],waiting:labels.slice(2),
        game_number:1,games:[],updated_at:new Date().toISOString()};
      record("TIMES_SORTEADOS",matchId,null,count+" times com cinco jogadores de linha; "+DEMO.bench[matchId].length+" reservas");
      saveDemo();return toJson({ok:true,teams:count,reserves:DEMO.bench[matchId].length});
    }

    // Rodízio: vencedor permanece; perdedor volta para o fim da fila.
    const rotation=path.match(/^\/api\/admin\/matches\/(\d+)\/rotation$/);
    if(rotation && method==="POST"){
      if(!isMaster())return failure("Acesso Master necessário",401);
      const matchId=Number(rotation[1]),item=DEMO.rotation[matchId];
      if(!item || item.playing?.length!==2)return failure("Sorteie os times antes",409);
      const [a,b]=item.playing, winner=body.winner;
      if(![a,b,"empate"].includes(winner))return failure("Informe o vencedor ou empate",422);
      // Empate: a saída deve ser decidida por sorteio, e o resultado é auditado.
      const leave=winner==="empate"?(Math.random()<0.5?a:b):(winner===a?b:a);
      const keep=leave===a?b:a,enter=item.waiting.shift();
      const oldGame={number:item.game_number,playing:[a,b],winner,
        leaves:leave,enters:enter||null,at:new Date().toISOString()};
      item.games.push(oldGame);
      if(enter){item.waiting.push(leave);item.playing=[keep,enter];}
      else {item.playing=[keep,leave];}
      item.game_number++;
      item.updated_at=new Date().toISOString();
      record("RODIZIO_ATUALIZADO",matchId,null,
        a+" x "+b+"; "+(winner==="empate"?"empate: sorteio de saída":"venceu: "+winner)+
        "; saiu: "+leave+"; entrou: "+(enter||"sem time na espera"));
      saveDemo();return toJson({ok:true,rotation:item});
    }

    if(method==="GET" && /^\/api\/admin\/matches\/\d+\/history$/.test(path)){
      if(!isMaster())return failure("Acesso Master necessário",401);
      const id=Number(path.split("/")[4]);
      return toJson({events:DEMO.events.filter(e=>e.match_id===id||(!e.match_id&&e.action==="CONVOCACAO_FINALIZADA"))});
    }

    // Guarda o estado anterior em cancelamentos para permitir restauração.
    const cancel=path.match(/^\/api\/admin\/registrations\/(\d+)\/cancel$/);
    if(cancel && method==="POST"){
      const r=DEMO.regs.find(x=>x.id===Number(cancel[1]));
      if(r && isMaster()){r.previous_status=r.status;r.previous_paid_at=r.paid_at||null;}
    }
    const queueRemove=path.match(/^\/api\/admin\/registrations\/(\d+)\/queue$/);
    if(queueRemove && method==="POST" && body.action==="remove"){
      const r=DEMO.regs.find(x=>x.id===Number(queueRemove[1]));
      if(r && isMaster()){r.previous_status=r.status;r.previous_paid_at=r.paid_at||null;}
    }

    // Corrige promoção manual: só LINE entra na capacidade de jogadores de linha.
    if(queueRemove && method==="POST" && body.action==="promote"){
      if(!isMaster())return failure("Acesso Master necessário",401);
      const r=DEMO.regs.find(x=>x.id===Number(queueRemove[1]));
      if(!r||r.status!=="waitlist")return failure("Jogador não está na espera",409);
      const m=DEMO.matches.find(x=>x.id===r.match_id);
      if(!m)return failure("Partida não encontrada",404);
      const targetIsGoalie=r.role==="goleiro";
      const occupied=targetIsGoalie?DEMO.regs.filter(x=>x.match_id===m.id&&x.role==="goleiro"&&["paid","reserved"].includes(x.status)).length:lineOccupied(m.id);
      const capacity=targetIsGoalie?m.goalie_limit:m.capacity;
      let changed=null;
      if(occupied>=capacity){
        changed=DEMO.regs.find(x=>x.id===Number(body.replace_registration_id)&&x.match_id===m.id&&x.role===r.role&&x.status==="reserved");
        if(!changed)return failure("Vagas ocupadas. Substitua uma reserva pendente da mesma categoria.",409);
      }
      if(changed){changed.status="waitlist";changed.queue_hold=1;changed.reserved_until=null;changed.queue_entered_at=new Date().toISOString();}
      r.status="reserved";r.queue_hold=0;r.reserved_until=targetIsGoalie?null:new Date(Date.now()+30*60000).toISOString();
      DEMO.notices.push({id:Date.now()+Math.random(),match_id:m.id,name:r.name,phone:r.phone,token:r.token,message:"Vaga liberada. Confirme sua participação dentro do prazo."});
      saveDemo();return toJson({ok:true});
    }

    const answer=await originalFetch(input,options);
    // Enriquece a consulta do Master com dados da rotação e histórico.
    if(method==="GET" && path==="/api/admin/overview" && answer.ok){
      const data=await answer.json();
      data.events=DEMO.events;
      data.rotation=DEMO.rotation;
      data.bench=DEMO.bench;
      data.registrations=data.registrations.map(r=>({...r,
        photo_data:DEMO.members.find(m=>m.id===r.member_id)?.photo_data||null}));
      return toJson(data);
    }
    const roster=path.match(/^\/api\/matches\/(\d+)\/roster$/);
    if(method==="GET" && roster && answer.ok){
      const data=await answer.json();
      data.roster=data.roster.map(r=>({...r,
        photo_data:DEMO.members.find(m=>m.id===r.member_id)?.photo_data||null}));
      return toJson(data);
    }
    return answer;
  };

  window.FUTEBOL_demoPhoto=async function(file){
    if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Use uma foto JPG, PNG ou WebP");
    if(file.size>3*1024*1024)throw Error("A foto deve ter até 3 MB");
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
      const canvas=document.createElement("canvas");
      const size=180;
      const scale=Math.min(1,size/Math.max(img.naturalWidth,img.naturalHeight));
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      const result=canvas.toDataURL("image/jpeg",0.7);
      if(result.length>100000)throw Error("Foto grande demais após otimização");
      return result;
    }finally{URL.revokeObjectURL(url)}
  };
})();
