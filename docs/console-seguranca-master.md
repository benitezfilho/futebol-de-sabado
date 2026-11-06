# Segurança Master: senha e e-mail local (demonstração)

Acesse o site: https://benitezfilho.github.io/futebol-de-sabado/

## Novo painel

Entre em **Admin Master → Segurança Master**. O console permite:

- **Alterar senha:** informe a senha atual, a nova senha e a confirmação. Após salvar, a sessão é encerrada e a nova senha é exigida para entrar.
- **Vincular ou trocar o e-mail de login:** informe um endereço de e-mail válido e confirme com a senha atual. O e-mail passa a ser solicitado no formulário de entrada do **mesmo navegador**.
- **Mostrar ou ocultar senha:** botões ao lado dos campos permitem visualizar **apenas os caracteres digitados naquele momento**.
- **Consultar o e-mail local salvo:** veja qual e-mail foi definido para esse navegador.

## Primeiro acesso e senhas anteriores

- Em um navegador novo, crie uma senha com pelo menos 10 caracteres, letra e número, e informe o e-mail para identificação local.
- Se a demonstração **já possuía senha** antes desta atualização, você pode entrar só com essa senha e depois vincular seu e-mail na aba Segurança Master. A atualização preserva o hash anterior.
- E-mail e senha são validados **no navegador**, não no backend.
- A senha salva não pode ser visualizada ou recuperada. O sistema armazena somente um hash PBKDF2-SHA256 com salt, para não conservar a senha em texto simples.
- Por segurança, uma alteração de senha exige conhecer a senha atual. Não existe recuperação automática por e-mail nesta demonstração.

## Limitações importantes

**Isto não é autenticação real.** O site é público, a validação local pode ser contornada, e a configuração não sincroniza entre celulares. Não utilize senha bancária, senha de e-mail ou outras senhas já utilizadas em serviços reais. Também não use dados pessoais reais na versão demonstrativa.

Um e-mail cadastrado nesta tela **não recebe automaticamente códigos nem prova quem controla o endereço**.

O próximo passo para um Admin Master efetivamente restrito é finalizar a API Cloudflare Workers e proteger as rotas administrativas com Cloudflare Access, política exclusiva para o e-mail autorizado e MFA. A autenticação por código de e-mail e MFA deve acontecer **no servidor/provedor**, não no JavaScript público.

A integração Pix continua em stand-by.
