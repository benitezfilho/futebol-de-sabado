/* Sorteio presencial independente | Demo local, nao altera inscricoes ou Pix */
(function(){
"use strict";
if(typeof DEMO==="undefined"||typeof saveDemo!=="function")return;
const esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const normalize=x=>String(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const clean=x=>String(x).replace(/^\s*(?:[•●*\-]\s*|\d{1,4}[.):\-]\s*)/,"").replace(/\s+/g," ").trim();
function names(input,label,max){
 const values=String(input||"").split(/\r?\n/).map(clean).filter(Boolean);
 if(values.length>max)throw Error(label+": limite de "+max+" pessoas.");
 const seen=new Set();
 for(const n of values){
  if(n.length<2||n.length>90)throw Error(label+": nome deve ter 2 a 90 caracteres.");
  const k=normalize(n);
  if(seen.has(k))throw Error(label+": nome repetido: "+n);
  seen.add(k);
 }
 return values;
}
function parse(lines,goalies){
 const players=names(lines,"Linha",240),keepers=names(goalies,"Goleiros",60);
 const seen=new Set(players.map(normalize));
 for(const k of keepers)if(seen.has(normalize(k)))throw Error(k+" consta nas duas listas.");
 return {players,keepers};
}
function teamSize(input){
 const n=Number(input);
 if(!Number.isInteger(n)||n<1||n>6)throw Error("Defina entre 1 e 6 jogadores de linha por time.");
 return n;
}
function randomInt(max){
 const range=4294967296,limit=Math.floor(range/max)*max;
 const a=new Uint32Array(1);
 do{crypto.getRandomValues(a)}while(a[0]>=limit);
 return a[0]%max;
}
function shuffle(input){
 const list=[...input];
 for(let i=list.length-1;i>0;i--){let j=randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}
 return list;
}
function title(i){
 let x=i+1,s="";
 while(x>0){x--;s=String.fromCharCode(65+x%26)+s;x=Math.floor(x/26);}
 return "Time "+s;
}
function calculate(lines,goalies,size,shuffleMethod=shuffle){
 const n=teamSize(size),p=parse(lines,goalies);
 const quantity=Math.floor(p.players.length/n);
 if(quantity<2)throw Error("Precisamos de pelo menos "+(n*2)+" presentes para montar dois times completos.");
 const randomized=shuffleMethod(p.players);
 return {teams:Array.from({length:quantity},(_,i)=>({
    name:title(i),players:randomized.slice(i*n,(i+1)*n)
   })),reserves:randomized.slice(quantity*n),goalkeepers:p.keepers,
   playersCount:p.players.length,perTeam:n,createdAt:new Date().toISOString()};
}
const data=()=>DEMO.manualDraws||(DEMO.manualDraws={});
function state(matchId){
 const id=String(matchId);
 if(!data()[id])data()[id]={lines:"",goalies:"",size:5,result:null,history:[]};
 return data()[id];
}
function persist(matchId,values){
 const current=state(matchId);
 current.lines=String(values.lines||"");current.goalies=String(values.goalies||"");
 current.size=teamSize(values.size);saveDemo();
 return current;
}
function draw(matchId,values){
 const result=calculate(values.lines,values.goalies,values.size);
 const item=persist(matchId,values);
 if(item.result){item.history.unshift(item.result);item.history=item.history.slice(0,10);}
 item.result=result;
 window.FUTEBOL_record_event?.("SORTEIO_MANUAL",Number(matchId),null,
   result.playersCount+" presentes, "+result.teams.length+" times de "+result.perTeam+
   ", "+result.reserves.length+" reservas e "+result.goalkeepers.length+" goleiros");
 saveDemo();return result;
}
function clear(matchId){
 data()[String(matchId)]={lines:"",goalies:"",size:5,result:null,history:[]};
 window.FUTEBOL_record_event?.("SORTEIO_MANUAL_LIMPO",Number(matchId),null,"Sorteio manual reiniciado");
 saveDemo();
}
function summary(lines,size){
 const count=String(lines||"").split(/\r?\n/).map(clean).filter(Boolean).length,n=Number(size)||5;
 return count+" presentes · "+Math.floor(count/n)+" time(s) completos de "+n+
   " · "+(count%n)+" reserva(s)"+(count<2*n?" · precisa de "+(2*n)+" para sortear":"");
}
function render(matchId){
 const item=state(matchId),result=item.result;
 const opts=[1,2,3,4,5,6].map(n=>'<option value="'+n+'" '+(item.size===n?'selected':'')+'>'+n+" jogadores por time</option>").join("");
 let results="";
 if(result){
  const cards=result.teams.map(t=>'<div class="team-card"><h3>'+esc(t.name)+'</h3><p class="muted">'+
    result.perTeam+' jogadores de linha</p><ol>'+t.players.map(n=>'<li>'+esc(n)+'</li>').join("")+"</ol></div>").join("");
  const reserves=result.reserves.map((n,i)=>'<div class="roster-person"><span class="roster-index">'+(i+1)+'</span><strong>'+esc(n)+'</strong></div>').join("")||'<p class="muted">Nenhum reserva.</p>';
  const goalies=result.goalkeepers.map(n=>'<div class="roster-person"><strong>🧤 '+esc(n)+'</strong></div>').join("")||'<p class="muted">Nenhum goleiro informado.</p>';
  results='<section class="panel mt" id="manual-draw-result">'+
   '<div class="row-between"><div><h3>Times sorteados</h3><p class="muted">'+result.teams.length+
   ' times, '+result.reserves.length+' reservas</p></div><button class="button button-sm button-outline" data-action="manual-copy">Copiar para WhatsApp</button></div>'+
   '<div class="team-grid mt">'+cards+'</div><div class="roster-grid mt">'+
   '<div class="roster-group"><h3>Reservas da linha ('+result.reserves.length+')</h3>'+reserves+'</div>'+
   '<div class="roster-group"><h3>Goleiros fixos ('+result.goalkeepers.length+')</h3>'+goalies+'</div></div>'+
   '<p class="notice">Sorteio independente da lista de inscritos, dos pagamentos e dos times oficiais.</p></section>';
 }
 return '<section class="panel" id="manual-draw-panel">'+
   '<h2>Sorteio manual dos presentes</h2><p class="muted">Digite somente quem chegou. Escolha entre 1 e 6 jogadores de linha por time.</p>'+
   '<div class="highlight-bar"><strong>Exemplos:</strong> com 15 jogadores e times de 5, teremos 3 times completos. Com 17, teremos 3 times e 2 reservas. Goleiros não entram no cálculo.</div>'+
   '<div class="form-grid mt"><div class="form-group"><label for="manual-lines">Jogadores de linha presentes (um por linha)</label>'+
   '<textarea id="manual-lines" class="form-control" rows="11" placeholder="Benitez&#10;João&#10;Ferreira&#10;CH&#10;Alan">'+esc(item.lines)+'</textarea>'+
   '<small class="muted">Cole nomes, inclusive os que ainda não constam da inscrição. Pode modificar a lista a qualquer momento.</small></div>'+
   '<div class="form-group"><label for="manual-goalies">Goleiros presentes (opcional)</label>'+
   '<textarea id="manual-goalies" class="form-control" rows="4" placeholder="Um goleiro por linha">'+esc(item.goalies)+'</textarea>'+
   '<label class="mt" for="manual-size">Quantidade de linha por time</label><select id="manual-size" class="form-control">'+opts+'</select>'+
   '<p class="notice" id="manual-preview" role="status">'+esc(summary(item.lines,item.size))+'</p></div></div>'+
   '<div class="row mt" style="gap:9px;flex-wrap:wrap">'+
   '<button class="button button-sm button-outline" data-action="manual-import">Carregar confirmados como sugestão</button>'+
   '<button class="button button-sm button-secondary" data-action="manual-save">Salvar lista de presentes</button>'+
   '<button class="button button-sm" data-action="manual-draw">Sortear agora</button>'+
   '<button class="button button-sm button-danger" data-action="manual-clear">Limpar sorteio manual</button></div>'+
   '<p class="status-text mt">Apenas demonstração: sorteio salvo neste navegador. Os times oficiais não são substituídos.</p>'+
   (item.history.length?'<small class="muted">'+item.history.length+' sorteio(s) anterior(es) preservado(s) nesta demonstração.</small>':"")+
   '</section>'+results;
}
function clipboard(matchId,matchTitle){
 const d=state(matchId).result;if(!d)throw Error("Sorteie os times antes de copiar.");
 let txt="⚽ "+String(matchTitle||"Futebol de Sábado")+" | Sorteio manual\n";
 txt+=d.playersCount+" presentes · "+d.perTeam+" por time\n\n";
 txt+=d.teams.map(t=>t.name+"\n"+t.players.map((p,i)=>(i+1)+". "+p).join("\n")).join("\n\n");
 if(d.reserves.length)txt+="\n\n⏳ Reservas\n"+d.reserves.join("\n");
 if(d.goalkeepers.length)txt+="\n\n🧤 Goleiros fixos\n"+d.goalkeepers.join("\n");
 return txt;
}
window.FUTEBOL_manualDraw={parse,calculate,summary,render,state,persist,draw,clear,clipboard};
})();