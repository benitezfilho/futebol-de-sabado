# Futebol de Sábado

Demonstração pública **V7** do site para organização de peladas e partidas de futebol society.

## Como abrir o site

A demonstração está em [index.html](./index.html). Para disponibilizá-la no navegador sem download:

1. Acesse **Settings → Pages** no repositório.
2. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
3. Em **Branch**, selecione `main` e `/(root)`, depois **Save**.
4. Aguarde a publicação indicada pelo GitHub Pages.
5. O endereço esperado será **https://benitezfilho.github.io/futebol-de-sabado/**.

**Atenção:** esse link só passa a funcionar depois que o GitHub Pages estiver ativado e a implantação for concluída.

## Importante sobre a demonstração

- Este site é uma **demonstração offline disponibilizada por páginas estáticas**, não uma implantação do servidor real.
- Login, verificação por SMS, pagamentos Pix e integração WhatsApp são simulados.
- O armazenamento do navegador não compartilha cadastros entre dispositivos.
- Não coloque dados reais de membros no protótipo público.
- A senha `demo123` é apenas uma senha de demonstração e **não deve ser utilizada em produção**.
- O fluxo automático de vagas e prazos exige um servidor hospedado e banco de dados persistente para funcionar de forma confiável.
- A integração de Pix automático está em espera, conforme decisão dos responsáveis.

## Próxima etapa

Implantar backend em hospedagem própria, banco persistente, gestão real de usuários e senha do Admin Master, validação por SMS, controles de privacidade e rotinas de calendário e fila automática. Antes de abrir inscrições reais, realizar testes de segurança e concorrência.