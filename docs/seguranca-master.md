# Segurança do Admin Master: sem senha no site público

## O que foi corrigido

- A demonstração do GitHub Pages **não possui mais senha hardcoded** no JavaScript.
- O painel acessado no site público é **simulado**: alterações locais, sem dados reais e sem privilégios sobre o banco D1.
- O backend Cloudflare bloqueia por padrão todas as rotas `/api/admin/*` se faltar sessão Cloudflare Access, `MASTER_EMAIL` ou `MASTER_API_KEY`.
- O site em GitHub Pages **não está conectado** a uma sessão real de Admin Master, e não deve ser usado para gerenciar dados de membros.

## Autenticação por e-mail sem contratar disparador

Usar **Cloudflare Access** sobre a API do Worker. Documentação:
https://developers.cloudflare.com/workers/configuration/cloudflare-access/
https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/

Quando o Worker estiver publicado, no painel Cloudflare:
1. Acesse **Zero Trust** (ative o plano Free se estiver disponível).
2. Em **Integrations → Identity providers**, adicione **One-time PIN** caso deseje entrar por código no e-mail.
3. Em **Access → Applications**, crie aplicação **Self-hosted** protegendo **somente** o hostname do Worker no caminho `/api/admin/*`. Confira se a proteção realmente intercepta as rotas e se o restante da API pública continua acessível.
4. Configure política **Allow** restrita **somente ao endereço de e-mail do Master**. Não escolha “Everyone” nem “qualquer e-mail”. Restrinja os métodos de login para evitar vias alternativas não desejadas.
5. No Worker, configure `MASTER_EMAIL` com o e-mail autorizado como segredo. No terminal, execute `npx wrangler secret put MASTER_EMAIL`, ou use o painel de variáveis secretas da Cloudflare. Nunca registre o e-mail e o token em commits públicos.
6. Configure também o segredo `MASTER_API_KEY` (mínimo de 32 caracteres). Esse token é exclusivo da integração servidor e **nunca deve ir para o JavaScript público**.
7. Após implantar a política de Access, valide: e-mail diferente bloqueado; ausência de sessão bloqueada; sessão válida e token ausente bloqueado.

**Atenção:** e-mail com código de uso único (OTP) é um método de autenticação por posse do e-mail; sozinho, não constitui necessariamente MFA. Para MFA verdadeiro, associe um autenticador (TOTP), chave de segurança ou um provedor de identidade que exija segundo fator. Confira as opções disponíveis no seu plano em https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/.

O Cloudflare Access faz o envio do OTP de login; não é preciso criar um disparador de e-mails para este acesso.

## Etapa que ainda falta

Um painel administrativo **real** precisa de sessão de navegador segura, proteção contra CSRF, expiração/revogação de sessão, controle de roles, limites de requisição, políticas de acesso por usuário e auditoria. O Worker atual é uma base de API, não um sistema de login de produção completo. Não publique o segredo `MASTER_API_KEY` no frontend. O site estático só exibe um Master demonstrativo.

Se o Cloudflare Zero Trust pedir forma de pagamento, confirme os termos do plano gratuito antes de prosseguir; não é necessário comprar serviço para manter a demonstração atual do GitHub Pages.
