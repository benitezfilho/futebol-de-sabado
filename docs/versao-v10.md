# V10 | Autenticação de usuários no Cloudflare D1 (fase de homologação)

## Objetivo
Adicionar **login de verdade com e-mail e senha**, sessões revogáveis, alteração de senha e gerenciamento inicial de contas pelo Master, **sem alterar os arquivos nem a experiência da V9**. Cadastro público, SMS, Pix automático e inscrições reais continuam desativados.

## Implementado na branch V10
- Migração `0005_user_sessions.sql`: sessões com SHA-256 do token (não guarda token em claro), expiração em 8 horas, revogação e limite de tentativas por e-mail.
- `cloudflare/src/auth.js`: PBKDF2-SHA256 com salt individual e 250.000 iterações; login com mensagens genéricas para credenciais inválidas, 5 falhas bloqueiam o e-mail por 15 minutos; `me`, `logout`, alteração de senha que invalida todas as sessões.
- Gestão administrativa `/api/admin/accounts`: listar, criar conta `member` ou `admin`, desabilitar ou redefinir senha provisória. As rotas permanecem atrás da **dupla exigência existente** no Worker: Cloudflare Access para o Master e `MASTER_API_KEY` (Bearer). Não usar esse segredo no navegador.
- `v10-login.html`: tela isolada para homologação, com URL pública do Worker configurável, token de sessão apenas em `sessionStorage`, login, perfil, alteração de senha e logout.
- Testes iniciais da autenticação adicionados à suíte do backend Cloudflare.

## Endpoints

| Método | Rota | Permissão |
| --- | --- | --- |
| POST | `/api/auth/login` | Pública (credenciais válidas) |
| GET | `/api/auth/me` | Bearer token de sessão |
| POST | `/api/auth/logout` | Bearer token de sessão |
| POST | `/api/auth/change-password` | Bearer token + senha atual |
| GET | `/api/admin/accounts` | Master Access + MASTER_API_KEY |
| POST | `/api/admin/accounts` | Master Access + MASTER_API_KEY |
| POST | `/api/admin/accounts/{id}/disable` | Master Access + MASTER_API_KEY |
| POST | `/api/admin/accounts/{id}/reset-password` | Master Access + MASTER_API_KEY |

`POST /api/admin/accounts` recebe `email`, `password` (provisória, mínimo 12 caracteres com letra e número), `role` (`member` ou `admin`) e `member_id` opcional se o membro já existir no D1. A conta Master não pode ser criada por esse endpoint. Contas de demonstração da V9 **não são migradas** automaticamente.

## Como homologar sem afetar a V9
1. Verifique configurações de Cloudflare Access, `MASTER_EMAIL`, `MASTER_API_KEY` e domínio permitido `SITE_ORIGIN` antes de publicar qualquer endpoint administrativo.
2. Rode `cd cloudflare && npm test` e verifique GitHub Actions; confirme todas as migrações em banco **de testes** primeiro.
3. Crie um Worker e banco D1 **de homologação**, isolados da produção; aplique as migrações 0001 a 0005 no D1 de teste.
4. Proteja `/api/admin/*` com Cloudflare Access e confirme que retorna 403 sem sessão Access, inclusive para solicitações diretas.
5. Crie uma conta fictícia pelo endpoint Master usando uma chamada autenticada em ambiente controlado; não publique segredos no repositório.
6. Hospede `v10-login.html` em ambiente de teste; configure nele a URL pública HTTPS do Worker; valide login, persistência entre carregamentos na mesma aba, logout e invalidação após alteração de senha.
7. Verifique rate limit, tentativas falhas, conta desativada, CORS e revogação de sessões.
8. Só depois integrar à área de jogadores do site oficial e planejar migração segura de contas; manter inscrição pública desativada até passar revisão de segurança e LGPD.

## Limitações e próximos passos
- **Não foi feito deploy** nem migração no D1 remoto durante esta implementação.
- O site principal V9 ainda usa o modo de demonstração local; a tela V10 é um laboratório isolado.
- O perfil `admin` no D1 ainda não concede acesso às rotas `/api/admin/*` (somente Master via Access + segredo).
- Não há recuperação self-service de senha nem validação de posse de e-mail; provisionamento/reset é administrativo. Não enviar senha provisória por canais inseguros.
- Antes de lançar, revisar proteção de abuso distribuído, mecanismo de verificação de e-mail, sessão/CSRF conforme arquitetura final e vinculação das inscrições reais aos membros autenticados.

## PeladaPro: identidade e três links separados (nova arquitetura)

A plataforma passa a se chamar **PeladaPro** na V10. A V9 permanece com o nome e código originais, publicada em `https://benitezfilho.github.io/futebol-de-sabado/`, sem redirecionamentos ou substituições nesta etapa.

### Identidade visual
- Marca tipográfica **PeladaPro**, com tema noturno azul-marinho, verde-gramado como cor de ação e cartões de alto contraste.
- Tom de interface curto, direto e mobile-first; informações públicas da próxima partida sem barreira de login.
- Estilo compartilhado entre portais, com conteúdo e menus específicos de cada perfil.

### Estrutura de links

| Portal | Rota na V10 | Exibição e objetivo |
| --- | --- | --- |
| Entrada | `/peladapro/` | Seleção dos ambientes |
| Jogador | `/peladapro/jogador/` | Agenda pública, login para minha conta, inscrições futuras |
| Administrador | `/peladapro/admin/` | Prévia de partidas, pagamentos e times; operações ainda bloqueadas |
| Admin Master | `/peladapro/master/` | Prévia de gestão de usuários, permissões e auditoria; operações ainda bloqueadas |

**Após aprovação**, podemos usar aliases mais curtos (`/jogador`, `/admin`, `/master`) em Cloudflare Pages ou domínio próprio. Os caminhos acima existem na branch mas **não estão publicados no site oficial** enquanto a Pull Request estiver em rascunho.

### Princípio técnico
Os três links não representam três aplicações: frontend segmentado + Worker compartilhado + D1. Para acessar cada portal, o login consulta `/api/auth/login` e verifica `/api/auth/me` e papel no D1. **A verificação no navegador serve somente para navegação**: qualquer endpoint operacional também deve impor RBAC no Worker.

- `member`: somente dados próprios, agenda e inscrições.
- `admin`: gerenciamento de partidas e pagamentos, após APIs protegidas por `admin`/`master`.
- `master`: configurações globais, papéis e contas, após autenticação forte com Cloudflare Access e autorização no Worker.
- O Worker V10 atual ainda não provisiona contas Master via login comum e mantém `/api/admin/*` exigindo Cloudflare Access e segredo privado. As novas páginas **não pedem nem expõem o segredo Master**.

### Simplificação
Visibilidade primária por perfil: jogador (próxima partida, minhas inscrições, conta); administrador (partidas, inscrições/Pix, times); master (usuários, segurança, configurações/auditoria). Ranking, MVP e histórico avançado serão agrupados em menus secundários ou adiados, **não apagados** da V9.

### Checklist para entrar em produção
1. Testes de navegação e responsividade dos três portais, com leitores de tela e navegadores móveis.
2. Homologar backend D1 isolado, CORS e criação/ativação verificada de contas; não reutilizar credenciais locais da V9.
3. Desenvolver proteção RBAC em **todas** as rotas administrativas; fluxo Master com Cloudflare Access, sem API key no browser.
4. Criar recuperação de senha verificada por e-mail ou fluxo administrativo seguro, sem SMS.
5. Ligar agenda, inscrições e pagamentos reais ao D1, com concorrência e auditoria de ações.
6. Confirmar testes E2E e segurança. Fazer publicação controlada e só então redirecionar links.

**Nesta entrega há telas de homologação e vínculo de login, não há deploy, criação de usuários reais, alterações no D1 remoto nem ativação de inscrições.**

## RBAC: controle por perfil no Worker (segunda etapa)

Adicionado `cloudflare/src/permissions.js`, com políticas específicas para `member`, `admin` e `master`. A API valida o token de sessão por consulta ao D1 **antes de conceder qualquer acesso aos novos painéis**.

| Rota | Perfil mínimo | Observação |
| --- | --- | --- |
| `GET /api/portal/player` | member/admin/master | Dados mínimos do próprio login |
| `GET /api/portal/admin` | admin/master | Visão geral de operação, somente leitura |
| `GET /api/portal/master` | master | Exige também identidade Cloudflare Access, associada a `MASTER_EMAIL` |

Os portais em `peladapro/` consultam agora a rota do respectivo perfil após login e ao restaurar a sessão. `POST/PATCH/DELETE` não foram habilitados nessas rotas. Nenhuma chave `MASTER_API_KEY` é solicitada nas páginas.

**Limitação deliberada:** as rotas antigas `/api/admin/*` continuam exigindo Cloudflare Access e o segredo Master privado, como antes. Para liberar as ações de admin e master pelo navegador, será preciso projetar e implementar endpoints novos com privilégios específicos e revisar a configuração real do Access.

**Atenção:** o fluxo de provisionamento inicial de `master` permanece bloqueado na API pública. Não criar Master automaticamente ao abrir a interface; configurar a identidade de forma segura na homologação.

A V9 não foi alterada nem houve implantação da branch V10. Esta etapa adicionou testes de autorização em `cloudflare/tests/permissions.test.js`; a execução deve ser confirmada no CI antes de considerar o recurso validado.

## Homologação automatizada sem tocar na V9

Arquivo: `.github/workflows/peladapro-v10-preview.yml` (executa na branch `feature/v10-d1-auth`, ou manualmente pelo GitHub Actions).
- Valida sintaxe dos módulos Worker e da interface.
- Executa os testes Node.js dos três perfis e da API.
- Aplica migrações SQL em SQLite **somente na memória do runner**, nunca no D1 remoto.
- Se os testes passarem, disponibiliza o artifact `peladapro-v10-portais` para revisão estática dos layouts.
- **Não publica um endereço público**, não faz deploy Worker, não cria D1 e não altera a V9.

Para uma URL de homologação real, ainda é necessário provisionar **novo** projeto Cloudflare Pages, Worker separado e banco D1 de testes e configurar CORS de acordo com a origem real. As credenciais da Cloudflare devem ser configuradas diretamente no provedor ou no GitHub Actions secrets, nunca em commits ou mensagens.

### Atenção sobre Cloudflare Access
O guard atual do Master consulta `ctx.access.getIdentity()`. Essa interface **não está confirmada** como mecanismo de identidade disponível no Worker implantado; a integração com Cloudflare Access deve ser revista e testada antes da publicação. Não desabilitar a proteção para contornar erros. A autenticação Master real **não está homologada**.

### Checklist antes de marcar a V10 como pronta
- [ ] GitHub Actions da branch V10 passa nos testes automatizados.
- [ ] Worker e D1 de **homologação** existem e foram vinculados sem reutilizar o D1 real.
- [ ] CORS do ambiente de preview configurado com origem precisa.
- [ ] Teste de negativa (jogador em /admin, administrador em /master) confirmado no servidor.
- [ ] Fluxo de provisionamento seguro de Master e integração Cloudflare Access validados.
- [ ] Telas de jogador/admin/master navegadas no desktop e no celular.
- [ ] Operações reais continuam indisponíveis até autorização e testes de integração completos.

## Ajustes adicionais da demonstração, 12/11/2026
- Na `index.html` da **branch V10**, removemos da tela de acesso do membro o botão **"Redefinir com código do Master"**, assim como o botão no modal de login. No painel local Master, removemos **"Gerar código de reset"** e o bloco explicativo desse processo. Não é uma remoção de mecanismos de recuperação do backend D1: estes permanecem em avaliação para uma solução segura de e-mail/identidade.
- Ao fechar o formulário de criação de conta ou trocar entre criação de conta e login, se já houver dados digitados o sistema pergunta antes de descartar. Após autenticar com sucesso, o modal fecha sem pedir confirmação.
- Para não perder ou sobrescrever a simulação histórica do navegador, a nova versão usa outra chave local, `peladapro_demo_14nov2026_v1`. Não executamos `localStorage.clear()`.
- Uma única partida simulada inicia em **14/11/2026, sábado, 09h** no **Farofa Society**, ingresso **R$ 15**, limite de **20 jogadores de linha**, **2 goleiros fora da capacidade**. Abertura **12/11 às 12h**; prazo Pix **13/11 às 18h**; encerramento de inscrição **14/11 às 08h** (horário de Goiânia).
- **Lista inicial vazia**: sem jogadores, goleiros, pagamentos, presenças, inscritos ou fila de espera pré-carregados. O botão de reinício do Master limpa somente a simulação de 14/11 guardada neste navegador.
- Testes estáticos iniciais em `cloudflare/tests/demo-14nov.test.js`.

Esses ajustes estão somente na branch `feature/v10-d1-auth`; **a V9 publicada continua exatamente como antes**. Não há propagação de dados entre dispositivos nem alteração no D1 remoto.

## Logout visível em todos os perfis
- Cada portal V10 (`jogador`, `admin`, `master`) exibe o botão **Sair** no cabeçalho **após validação da sessão**. O botão interno no painel foi mantido para facilitar o acesso pelo celular.
- O botão chama `POST /api/auth/logout`, exclui o token de sessão da aba e retorna à tela de login. Se a API estiver indisponível, a sessão local é encerrada e aparece um aviso de que não foi possível confirmar a revogação remota.
- Na demonstração isolada da branch V10, o cabeçalho também disponibiliza **Sair da conta** para membros e **Sair do Master** para o Admin Master. O modal de confirmação existente continua funcionando.
- Quando não houver sessão, os botões ficam ocultos (inclusive se outros estilos CSS forem aplicados).
- Testes adicionados em `cloudflare/tests/logout-ui.test.js`. A execução ainda precisa ser confirmada no GitHub Actions.

A V9 publicada não recebeu alterações.

## Senha simplificada somente na demonstração (12/11/2026)
- A senha **local de demonstração** de membro e Admin Master passa a aceitar **3 a 128 caracteres**. Campos de cadastro, confirmação de senha, alteração de senha e validação local foram ajustados.
- A verificação de confirmação permanece obrigatória. Trata-se de um modo de testes com dados fictícios; **não utilizar a senha de três caracteres em contas reais**.
- A API de autenticação real do Cloudflare D1 **mantém o mínimo de 12 caracteres** por segurança.
- Adicionado teste de regressão em `cloudflare/tests/demo-password-length.test.js`.
- **V9 publicada e branch main não foram alteradas**; a V10 segue em homologação.
