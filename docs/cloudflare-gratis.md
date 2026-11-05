# Implantar o backend na Cloudflare (plano gratuito)

**Situação:** código em desenvolvimento, ainda sem conexão com o site público. A demonstração atual continua no GitHub Pages.

## 1. Criar a conta e instalar as ferramentas

1. Abra https://dash.cloudflare.com/sign-up e crie a conta gratuita.
2. Instale Node.js LTS (https://nodejs.org/) e Git (https://git-scm.com/).
3. No terminal do seu computador:

   git clone https://github.com/benitezfilho/futebol-de-sabado.git
   cd futebol-de-sabado/cloudflare
   npm install
   npx wrangler login

**Não compartilhe senhas, tokens ou códigos com o ChatGPT ou em arquivos públicos.**

## 2. Criar banco D1 gratuito

No terminal, na pasta \`cloudflare\`:

   npx wrangler d1 create futebol-de-sabado-db

Copie o \`database_id\` retornado. Abra \`cloudflare/wrangler.toml\` e substitua a linha
\`database_id = "COLE_AQUI_O_DATABASE_ID"\` pelo ID recebido, entre aspas.

Depois execute:

   npx wrangler d1 migrations apply futebol-de-sabado-db --remote

As tabelas iniciais serão criadas. Não rode migrações de produção sem revisar o código.

## 3. Configurar segredo do Master

O projeto NÃO tem senha padrão de produção. É obrigatório cadastrar um segredo forte, de pelo menos 32 caracteres:

   npx wrangler secret put MASTER_API_KEY

Cole um token longo e exclusivo no terminal quando solicitado. **Nunca coloque o valor no wrangler.toml, README, index.html, GitHub ou conversa.**

Essa primeira API usa token Bearer para operações Master; ainda não equivale ao login final com sessões e permissões. Não compartilhe o token com membros.

## 4. Publicar o Worker

   npx wrangler deploy

O terminal informará o endereço HTTPS da API, parecido com
\`https://futebol-de-sabado-api.SEU-SUBDOMINIO.workers.dev\`.

Verifique no navegador:

   https://SEU-ENDERECO.workers.dev/health

Resposta esperada (resumida): \`{"ok":true,"registration_enabled":false}\`.

Para consultar partidas, abra \`/api/matches\`. Inicialmente a lista estará vazia. **Não existe importação automática dos dados fictícios da demonstração.**

## 5. Automatização

O \`wrangler.toml\` contém \`[triggers] crons = ["* * * * *"]\`. Isso executa a rotina a cada minuto, em UTC, sem garantir precisão ao segundo. Ela:

- Expira reservas de jogadores de linha com prazo vencido.
- A partir do horário de liberação da fila, promove os próximos por ordem de espera.
- Dá a cada promovido o prazo editável da partida (30 minutos, se configurado).
- Não desloca quem já está confirmado como pago.
- Mantém goleiros separados da capacidade dos jogadores de linha.

As datas recebidas pela API precisam conter fuso horário. Em Goiânia (UTC-3), quinta às 12h corresponde a 15:00Z; quinta às 20h corresponde a 23:00Z.

## 6. Estado atual e bloqueios de segurança

Esta API tem rotas públicas **somente de leitura** e rotas administrativas protegidas por \`MASTER_API_KEY\`.

- Cadastro público de membros continua **desativado** até existir verificação real de titularidade e sessões seguras.
- SMS, Pix automático e WhatsApp automático não estão ativados.
- A interface do GitHub Pages ainda não chama a API nova; essa integração é uma etapa separada.
- A criação de conta de membro só será aberta após validar o fluxo com os responsáveis e testar proteção de dados.
- Não registre jogadores reais no protótipo HTML local.
- Faça backups do D1 e monitore os limites da faixa Free.
- Dados pessoais (nome, e-mail, telefone, fotos) devem permanecer no banco, **nunca em commits GitHub**.

## 7. Documentação técnica

- Workers: https://developers.cloudflare.com/workers/
- D1: https://developers.cloudflare.com/d1/
- Migrações: https://developers.cloudflare.com/d1/reference/migrations/
- Agendamentos: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Limites: https://developers.cloudflare.com/workers/platform/limits/

## 8. O que falta antes de liberar o futebol real

1. Conectar a interface (hoje estática) à API publicada.
2. Implementar login e verificação real de identidade dos membros.
3. Habilitar autenticação Master com sessão segura, sem exposição de token.
4. Implementar inscrição individual no D1 com controle de concorrência.
5. Testar alterações de partidas, pagamento manual, fila, cancelamentos e restauração.
6. Realizar homologação de segurança e privacidade.
