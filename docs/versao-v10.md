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
