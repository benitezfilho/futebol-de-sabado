# Implantação da API real | Futebol de Sábado

## Situação atual

- O GitHub Pages é uma **demonstração estática**: https://benitezfilho.github.io/futebol-de-sabado/
- A pasta backend/ contém a **primeira base da API**; a interface V7 ainda não está integrada.
- O Pix automático segue em espera e WhatsApp automático permanece desativado.
- O login por SMS depende da ativação de Twilio Verify, sem credenciais neste repositório.

## Implantação no Render

1. Acesse https://dashboard.render.com/ e conecte o GitHub.
2. Em **New > Blueprint**, escolha benitezfilho/futebol-de-sabado. O arquivo de configuração é render.yaml na raiz.
3. Revise a criação do Web Service Starter e do disco persistente de 1 GB. **Ambos são pagos**. Aprove o custo somente se estiver de acordo.
4. Nas variáveis privadas, configure MASTER_EMAIL e ADMIN_PASSWORD. A senha de demonstração demo123 não é válida para produção.
5. O Render gera SESSION_SECRET e define PUBLIC_BASE_URL com a URL HTTPS atribuída ao serviço.
6. Confira /health e /api/config. Sem Twilio, os códigos SMS permanecem desativados.

## Login individual futuro

Preencha no Render, e nunca no GitHub, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_VERIFY_SERVICE_SID.
O código é enviado ao telefone. Há limite inicial de até 5 solicitações/h por número e 15/h por IP. Antes do uso real, complemente com CAPTCHA, Twilio Fraud Guard e monitoramento da fatura.
O telefone validado não comprova identidade civil e pessoas com números distintos ainda podem criar múltiplas contas.

## Regras que a API cobre nesta primeira fase

- Vagas de linha e de goleiros têm contadores separados.
- Bloqueio de inscrição antes do horário de abertura.
- Verificação periódica de prazos e fila FIFO a cada cerca de 30 segundos, enquanto o servidor está online.
- Prazo de 30 minutos para quem foi promovido da fila.
- Histórico de interesse quando todas as vagas de linha já estão pagas.
- Ordem dos dez primeiros por horário de pagamento confirmado manualmente.
- Eventos de auditoria armazenados no banco.

## Antes de liberar cadastros reais

É preciso integrar o frontend V7 com a API, ativar o SMS, configurar backups e testar recuperação do banco, concorrência e privacidade. O SQLite exige uma única instância com disco persistente. Não cadastre jogadores reais no GitHub Pages.

## Teste local

Entre na pasta backend, instale requirements-dev.txt, execute python -m pytest -q e inicie com uvicorn main:app --reload. A documentação interativa fica em /docs.
