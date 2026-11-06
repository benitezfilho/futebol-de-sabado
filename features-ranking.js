/* Períodos do Ranking | Demonstração local.
 * Nenhuma ação aqui publica no D1 ou altera jogadores reais.
 */
(function(){
  "use strict";
  if(typeof DEMO==="undefined" || typeof saveDemo!=="function")return;

  const now=()=>new Date().toISOString();
  const uuid=()=>typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"
    ?crypto.randomUUID():"ranking-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  if(!Array.isArray(DEMO.rankPeriods)){
    DEMO.rankPeriods=[{
      id:uuid(),title:"Ranking 2026",start_date:"2026-01-01",end_date:"2026-12-31",
      status:"open",created_at:now(),updated_at:now(),opened_at:now(),
      closed_at:null,snapshot:null,closures:[]
    }];
    saveDemo();
  }

  const originalFetch=window.fetch;
  const response=(data,status=200)=>new Response(JSON.stringify(data),{
    status,headers:{"Content-Type":"application/json; charset=utf-8"}
  });
  const error=(message,status=400)=>response({detail:message},status);
  const safePeriod=p=>({
    id:p.id,title:p.title,start_date:p.start_date,end_date:p.end_date,
    status:p.status,created_at:p.created_at,updated_at:p.updated_at,
    opened_at:p.opened_at||null,closed_at:p.closed_at||null,
    previous_closures:Array.isArray(p.closures)?p.closures.length:0
  });
  const localDate=iso=>new Intl.DateTimeFormat("sv-SE",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(new Date(iso));
  function validate(input){
    const title=String(input.title||"").trim();
    const start=String(input.start_date||""),end=String(input.end_date||"");
    if(title.length<3 || title.length>100)throw new Error("Nome do ranking: 3 a 100 caracteres.");
    for(const value of [start,end]){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(value+"T12:00:00Z")) ||
          new Date(value+"T12:00:00Z").toISOString().slice(0,10)!==value)
        throw new Error("Informe datas reais no formato AAAA-MM-DD.");
    }
    if(start>end)throw new Error("A data inicial não pode ser posterior à data final.");
    return {title,start_date:start,end_date:end};
  }
  function audit(action,period){
    window.FUTEBOL_record_event?.(action,null,null,
      period.title+" ("+period.start_date+" a "+period.end_date+")");
  }
  function calculate(period){
    const result=new Map();
    const eligibleMatches=new Set(DEMO.matches.filter(m=>
      m.starts_at && localDate(m.starts_at)>=period.start_date && localDate(m.starts_at)<=period.end_date
    ).map(m=>m.id));
    const regs=DEMO.regs.filter(r=>r.status==="paid" && eligibleMatches.has(r.match_id));
    const mvpWinners=new Set();
    for(const matchId of eligibleMatches){
      const votes=new Map();
      for(const vote of DEMO.votes||[]){
        if(vote.match_id!==matchId)continue;
        const reg=regs.find(r=>r.id===vote.voted_registration_id&&r.match_id===matchId);
        if(!reg)continue;
        votes.set(reg.id,(votes.get(reg.id)||0)+1);
      }
      const top=Math.max(0,...votes.values());
      const leaders=[...votes].filter(([,value])=>value===top&&top>0);
      // Um empate não gera MVP até ser resolvido.
      if(leaders.length===1)mvpWinners.add(leaders[0][0]);
    }
    for(const r of regs){
      const entry=result.get(r.member_id)||{
        member_id:r.member_id,name:r.name,presencas:0,gols:0,assistencias:0,mvps:0,pontos:0
      };
      const st=DEMO.stats.find(s=>s.registration_id===r.id);
      entry.presencas+=r.attended?1:0;
      entry.gols+=Math.max(0,Number(st?.goals)||0);
      entry.assistencias+=Math.max(0,Number(st?.assists)||0);
      entry.mvps+=mvpWinners.has(r.id)?1:0;
      result.set(r.member_id,entry);
    }
    return [...result.values()].map(p=>({...p,
      pontos:p.gols*3+p.assistencias*2+p.mvps*5+p.presencas
    })).sort((a,b)=>b.pontos-a.pontos||b.gols-a.gols||b.assistencias-a.assistencias||
      a.name.localeCompare(b.name,"pt-BR"));
  }
  function periodsSorted(){
    return [...DEMO.rankPeriods].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))||
      String(b.start_date).localeCompare(String(a.start_date)));
  }
  function currentPeriod(id){
    if(id)return DEMO.rankPeriods.find(p=>p.id===id);
    return periodsSorted().find(p=>p.status==="open")||periodsSorted()[0]||null;
  }
  function getRanking(p){
    return p.status==="closed"&&Array.isArray(p.snapshot)
      ?p.snapshot.map(row=>({...row})):calculate(p);
  }
  window.FUTEBOL_calcRankingPeriod=calculate;
  window.FUTEBOL_getRankPeriods=()=>DEMO.rankPeriods.map(safePeriod);

  window.fetch=async function(input,options={}){
    const url=String(input),path=url.split("?")[0],method=String(options.method||"GET").toUpperCase();
    const params=new URLSearchParams(url.includes("?")?url.slice(url.indexOf("?")+1):"");
    let body={};
    if(options.body){try{body=JSON.parse(options.body)}catch{return error("JSON inválido");}}
    if(method==="GET" && path==="/api/ranking"){
      const id=params.get("period"),selected=currentPeriod(id);
      if(id&&!selected)return error("Período de ranking não encontrado",404);
      return response({
        ranking:selected?getRanking(selected):[],
        period:selected?safePeriod(selected):null,
        periods:periodsSorted().map(safePeriod)
      });
    }
    if(path==="/api/admin/ranking-periods" && method==="GET"){
      if(!DEMO.adminLogged)return error("Acesso administrativo necessário",401);
      return response({periods:periodsSorted().map(safePeriod)});
    }
    if(path==="/api/admin/ranking-periods" && method==="POST"){
      if(!DEMO.adminLogged)return error("Acesso administrativo necessário",401);
      let values;try{values=validate(body)}catch(e){return error(e.message,422)}
      const timestamp=now();
      const period={...values,id:uuid(),status:"closed",created_at:timestamp,updated_at:timestamp,
        opened_at:null,closed_at:timestamp,snapshot:[],closures:[]};
      DEMO.rankPeriods.push(period);
      audit("RANKING_PERIODO_CRIADO",period);saveDemo();
      return response({period:safePeriod(period)},201);
    }
    const match=path.match(/^\/api\/admin\/ranking-periods\/([^/]+)(?:\/(open|close))?$/);
    if(match){
      if(!DEMO.adminLogged)return error("Acesso administrativo necessário",401);
      const period=DEMO.rankPeriods.find(x=>x.id===decodeURIComponent(match[1]));
      if(!period)return error("Período não encontrado",404);
      if(method==="PATCH"&&!match[2]){
        if(period.status!=="open")return error("Reabra o ranking para alterar datas ou nome.",409);
        let data;try{data=validate({...period,...body})}catch(e){return error(e.message,422)}
        Object.assign(period,data,{updated_at:now()});
        audit("RANKING_DATAS_ALTERADAS",period);saveDemo();
        return response({period:safePeriod(period)});
      }
      if(method==="POST" && match[2]==="open"){
        if(period.status==="open")return error("Ranking já está aberto",409);
        period.status="open";
        period.opened_at=now();period.updated_at=period.opened_at;
        period.snapshot=null;
        audit("RANKING_REABERTO",period);saveDemo();
        return response({period:safePeriod(period)});
      }
      if(method==="POST" && match[2]==="close"){
        if(period.status==="closed")return error("Ranking já está encerrado",409);
        const when=now(),snapshot=calculate(period);
        period.status="closed";period.closed_at=when;period.updated_at=when;
        period.snapshot=structuredClone(snapshot);
        period.closures||=[];
        period.closures.push({at:when,snapshot:structuredClone(snapshot),start_date:period.start_date,end_date:period.end_date});
        audit("RANKING_ENCERRADO",period);saveDemo();
        return response({period:safePeriod(period),players:snapshot.length});
      }
      return error("Operação não permitida",405);
    }
    const original=await originalFetch(input,options);
    if(method==="GET"&&path==="/api/admin/overview"&&original.ok){
      const data=await original.json();
      data.ranking_periods=periodsSorted().map(safePeriod);
      return response(data);
    }
    return original;
  };
})();
