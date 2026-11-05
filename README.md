# Futebol de Sábado

**Demonstração pública V7:** https://benitezfilho.github.io/futebol-de-sabado/

O site visual publicado continua **em modo demonstração**. Login SMS, Pix e dados de jogadores não são reais.

## Backend real em desenvolvimento

A primeira base do servidor está em [backend/](backend/), com API FastAPI e SQLite para membros, partidas, inscrições e histórico.
O login Master usa credenciais privadas no servidor. Os membros precisam de verificação por SMS com Twilio Verify, que ainda não foi ativada.
Os goleiros têm controle separado, a lista abre no horário configurado e o servidor processa vencimentos e fila de espera. A confirmação do Pix é manual; Pix automático continua em espera.

**Importante:** o front-end V7 do GitHub Pages ainda não está conectado à API. Não use o protótipo para inscrições reais.

- [Guia de implantação e segurança](docs/IMPLANTACAO-API.md)
- [Render Blueprint](render.yaml), com hospedagem e disco persistente pagos, ainda não ativados
- [Código do backend](backend/main.py)
- [Testes](backend/tests/test_api.py) e workflow GitHub Actions
