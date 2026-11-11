// PeladaPro V10 — protótipo de três portais com verificação de perfil no D1.
// Não confundir visualização por perfil com autorização: o Worker precisa validar
// permissões em cada operação. Nenhuma chave Master é solicitada no frontend.
const $=(s,root=document)=>root.querySelector(s);
const root=$("[data-portal]");
const STORAGE_API="peladapro_v10_api_origin";
const STORAGE_TOKEN="peladapro_v10_session";
const LEGACY_API="futebol_v10_public_api_url";
const LEGACY_TOKEN="futebol_v10_token";
const role=root?.dataset.portal||"member";
let apiOrigin=localStorage.getItem(STORAGE_API)||localStorage.getItem(LEGACY_API)||"";
let token=sessionStorage.getItem(STORAGE_TOKEN)||sessionStorage.getItem(LEGACY_TOKEN)||"";
const status=document.createElement("p");status.className="status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
function say(m){status.textContent=m}
function allowed(account){return !!account&&account.role===role&&account.active!==false}
function clearToken(){token="";sessionStorage.removeItem(STORAGE_TOKEN);sessionStorage.removeItem(LEGACY_TOKEN)}
function setToken(value){token=value;sessionStorage.setItem(STORAGE_TOKEN,value)}
async function call(path,{method="GET",data,authenticated=true}={}){
 if(!apiOrigin)throw Error("Informe o endereço público da API para a homologação.");
 const headers={"Content-Type":"application/json"};
 if(authenticated&&token)headers.Authorization="Bearer "+token;
 const res=await fetch(apiOrigin+path,{method,headers,cache:"no-store",...(data!==undefined?{body:JSON.stringify(data)}:{})});
 const value=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(value.error||"Falha de comunicação com o servidor.");
 return value;
}
async function verifyPanel(){
 const route={member:"player",admin:"admin",master:"master"}[role];
 return call("/api/portal/"+route);
}
function show(account){
 const login=$("[data-login]",root),dashboard=$("[data-dashboard]",root);
 login.classList.toggle("hidden",!!account);dashboard.classList.toggle("hidden",!account);
 if(account)$("[data-greeting]",root).textContent="Conta: "+account.email+" | Perfil: "+account.role;
}
function buildLogin(){
 const login=$("[data-login]",root);
 const description=role==="master"?"Somente contas Master cadastradas e validadas no servidor. Este ambiente ainda não está liberado para operações.":role==="admin"?"Acesso reservado a administradores.":"Use o e-mail e a senha cadastrados para sua conta.";
 const text=document.createElement("p");text.className="muted";text.textContent=description;
 const form=document.createElement("form");
 form.innerHTML='<label for="api-url">API de homologação (HTTPS)</label><input id="api-url" name="origin" type="url" placeholder="https://seu-worker.workers.dev" required><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required><button class="button full" type="submit">Entrar</button>';
 form.elements.origin.value=apiOrigin;
 form.addEventListener("submit",async event=>{
 event.preventDefault();
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
 try{
  const url=new URL(form.elements.origin.value);
  if(url.protocol!=="https:"||url.username||url.password)throw Error("Utilize uma URL HTTPS válida, sem credenciais.");
  apiOrigin=url.origin;localStorage.setItem(STORAGE_API,apiOrigin);
  const result=await call("/api/auth/login",{method:"POST",data:{email:form.elements.email.value,password:form.elements.password.value},authenticated:false});
  if(!allowed(result.account)){
    // Não manter uma sessão emitida para um perfil diferente do portal.
    const otherToken=token;token=result.token;
    try{await call("/api/auth/logout",{method:"POST"})}catch{}
    token=otherToken;
    throw Error("Esta conta não tem permissão para esta área.");
  }
  clearToken();setToken(result.token);form.elements.password.value="";
  try{
   const panel=await verifyPanel();
   show(panel.account);say("Acesso autenticado e permissões verificadas no servidor.");
  }catch(error){clearToken();show(null);throw error}
 }catch(error){say(error.message)}finally{btn.disabled=false}
 });
 login.append(text,form,status);
 const out=$("[data-logout]",root);
 out.addEventListener("click",async()=>{
  try{await call("/api/auth/logout",{method:"POST"})}catch{say("Não foi possível confirmar a revogação no servidor. A sessão local será encerrada.");}
  clearToken();show(null);say("Acesso encerrado. Para entrar novamente, informe a senha.");
 });
}
async function restoreSession(){
 if(!token||!apiOrigin){show(null);return}
 try{
  const result=await call("/api/auth/me");
  if(!allowed(result.account)){show(null);say("A sessão atual não autoriza este painel.");return}
  const panel=await verifyPanel();
  show(panel.account);say("Sessão e permissões confirmadas pelo D1.");
 }catch{clearToken();show(null);say("Sessão expirada ou inválida.");}
}
async function loadPublicMatches(){
 if(role!=="member"||!apiOrigin)return;
 try{
  const result=await call("/api/matches",{authenticated:false});
  const matches=Array.isArray(result.matches)?result.matches:[];
  const match=matches.find(m=>m.status==="active")||matches[0];
  if(!match)return;
  $("#match-title").textContent=match.title||"Próxima partida";
  const starts=match.starts_at?new Date(match.starts_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Horário a confirmar";
  $("#match-detail").textContent=starts+" · "+(match.venue||"Local a confirmar")+" · "+(Number(match.price_cents||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  $("#match-note").textContent="Partida consultada na API de homologação.";
 }catch{$("#match-note").textContent="Não foi possível consultar a agenda na API de homologação."}
}
if(root){buildLogin();await restoreSession();await loadPublicMatches();}
