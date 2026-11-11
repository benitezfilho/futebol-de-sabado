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
