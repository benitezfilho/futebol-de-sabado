# V9 | Sorteio manual, cadastro administrativo e confirmação de saída

## 1. Sorteio manual dos jogadores presentes

Acesse **Admin Master → Sorteio manual**.

- Informe um nome por linha no campo Jogadores de linha presentes.
- Se quiser, use **Carregar confirmados como sugestão** e remova quem não chegou. Essa ação não marca presença automaticamente nem altera inscrições.
- Informe goleiros presentes em campo separado (opcional).
- Escolha livremente 1, 2, 3, 4, 5 ou 6 jogadores de linha por time.
- Clique em **Sortear agora**. Apenas times completos são formados. Quem sobrar fica no grupo de reservas.
- Exemplo: **15 jogadores** e **5 por time** geram **3 times e 0 reservas**; **17 jogadores** geram **3 times e 2 reservas**.
- **Salvar lista de presentes** permite guardar o rascunho sem sortear. **Sortear agora** pode ser usado repetidamente, preservando os 10 sorteios anteriores na demonstração.
- **Copiar para WhatsApp** copia o resultado para compartilhar manualmente.
- O sorteio manual é **independente** do sorteio oficial dos primeiros 10 pagantes. Não altera pagamentos, inscrições, ranking ou ordem de pagamento.

## 2. Admin Master pode cadastrar um membro manualmente

Use **Admin Master → + Jogador manual** (atalho superior) ou **Membros → + Cadastrar jogador manualmente**.

Preencha: nome completo, e-mail e celular com DDD. A posição é opcional. Se desejar, vincule à partida selecionada.

- Não duplica membros com telefone ou e-mail já cadastrados.
- Não confirma Pix sem verificação da organização.
- O jogador de linha entra com status aguardando Pix se houver vaga. Caso contrário vai à fila manual, ou fica apenas como interesse histórico se todas as vagas estiverem pagas.
- O goleiro não ocupa vaga de linha e aguarda aprovação do Master.
- O registro fica marcado como cadastrado pelo Master, com contato ainda não verificado. Não equivale a confirmação por SMS.
- Sem escolher partida, cria apenas um registro de membro.

**Importante:** nesta versão, os cadastros manuais usam armazenamento local do navegador, sem banco D1. Para não expor pessoas, utilize dados fictícios ou de teste. Cadastros reais exigem API autenticada, regras de acesso, tratamento adequado dos dados e consentimento.

## 3. Confirmar saída

Tanto o botão **Sair** do Admin Master quanto o da Área do Membro abrem uma janela central:

**Tem certeza que deseja sair?** Escolha **Não, continuar** ou **Sim, sair**.

Confirmar encerra a sessão demonstrativa e retorna à página inicial. Cancelar mantém a sessão.

## 4. Aviso de demonstração

O aviso flutuante fixo do canto inferior direito foi removido para não encobrir botões. O painel continua informando que a versão é demonstrativa em uma faixa própria no conteúdo.

## 5. Testes

Os testes do GitHub Actions verificam:
- Sorteios com 15 e 17 presentes e 1 a 6 jogadores por time.
- Proibição de nomes repetidos e inclusão indevida de goleiro como jogador de linha.
- Cadastro manual, duplicidade de telefone e e-mail, goleiro isento, lotação e falta de autenticação.
- Navegação no Chrome, pop-up central de saída, botão de cancelamento e acesso ao sorteio manual.

Site: https://benitezfilho.github.io/futebol-de-sabado/

API D1 de produção, Pix automático e envio de WhatsApp automatizado **não estão ativados**.
