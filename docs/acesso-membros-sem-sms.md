# Acesso dos membros sem SMS | Demonstração

## Decisão do projeto

**A autenticação por SMS ficará em stand-by**, sem integração com serviço pago. A demonstração passa a trabalhar com e-mail e senha apenas para testes neste navegador.

## Área do membro

Em **Área do membro**, o jogador pode:
- criar uma conta de teste com nome completo, e-mail, celular de referência e senha;
- entrar com e-mail e senha, sem SMS;
- acessar **Minha conta / Senha** para alterar a própria senha;
- solicitar ao Admin Master um código de redefinição, se esquecer a senha.

O celular é cadastrado como dado de contato, **não é verificado** neste fluxo. Nem e-mail nem celular recebem mensagens automáticas.

## Admin Master

Na nova aba **Usuários e acessos**, o Master pode:
- visualizar cadastros de teste e o status da credencial (senha criada, sem senha, reset pendente);
- cadastrar membros manualmente como antes;
- gerar um **código de redefinição único**, de uso único, válido por até 60 minutos;
- compartilhar esse código manualmente com o jogador, em comunicação privada.

**O Master nunca visualiza a senha existente.** Ao gerar o reset, o acesso pela senha antiga deixa de funcionar. O jogador utiliza o código e define a própria senha. A tentativa de recuperação é limitada e o código não fica salvo em texto simples.

A aba **Segurança Master** continua exclusiva para a senha e o e-mail local do organizador.

## Limites da demonstração

Esta é uma simulação de navegador, com dados e hashes de senha no armazenamento local. **Não é um sistema autenticado de produção** e não sincroniza entre diferentes celulares. O código de recuperação gerado no navegador do Master não será reconhecido no navegador de outra pessoa até conectarmos o backend compartilhado. Teste o fluxo em um mesmo navegador/perfil.

A estrutura do banco para produção foi preparada em [0004_user_accounts.sql](../cloudflare/migrations/0004_user_accounts.sql), mas não está conectada ao site público. Ela não ativa envio de e-mail, SMS, autenticação real, cobrança ou mudança de permissões.

Antes de usar com jogadores reais, precisamos de autenticação no servidor, políticas de acesso (inclusive Admin Master), proteção contra tentativas repetidas, tratamento de dados pessoais e mecanismo confiável de recuperação de conta.

## Como testar

1. Abra https://benitezfilho.github.io/futebol-de-sabado/
2. Entre em **Área do membro → Criar minha conta** com dados fictícios.
3. Abra **Minha conta / Senha** para alterar a senha. Faça logout e entre novamente.
4. Entre no **Admin Master → Usuários e acessos**. Gere um código de redefinição para a conta de teste.
5. Saia do membro, abra **Área do membro → Redefinir com código do Master**, cole o código e cadastre uma nova senha.

SMS: **stand-by**.
Pix automático: **stand-by**.
