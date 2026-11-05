# Futebol de Sábado | versão 8 (demonstração)

Publicação de testes: https://benitezfilho.github.io/futebol-de-sabado/

## Regras contempladas na V8

1. **Linha e goleiros separados:** a capacidade configurada (por exemplo, 22) conta apenas jogadores de linha. Goleiros ficam em outra lista, são isentos mediante aprovação e não entram no sorteio dos times de linha.
2. **Times de cinco:** o sorteio monta times completos de exatamente cinco jogadores de linha. Se houver 22 pagantes e forem escolhidos quatro times, 20 vão para A/B/C/D e dois ficam no banco.
3. **Primeiros dez:** os dez primeiros pagamentos de linha compõem os times A e B, distribuídos aleatoriamente entre eles. A classificação na página inicial continua pelo horário do Pix confirmado.
4. **Rodízio:** A × B abrem o jogo. Quem vence permanece. O perdedor sai para a última posição da fila de times. C entra, depois D e assim por diante. Em caso de empate, o sistema sorteia quem sai; o resultado fica no histórico. O Master registra os resultados no painel.
5. **Posições opcionais:** atacante, centroavante, ponta direita/esquerda, meia, meia-atacante, volante, zagueiro, lateral direito/esquerdo, ala, coringa de linha e goleiro. Sem preferência continua disponível.
6. **Foto do membro:** upload JPG/PNG/WebP de até 3 MB, otimização para miniatura e exibição no perfil e na lista de jogadores. **Somente demonstração:** a foto é armazenada no navegador, não entre aparelhos. Armazenamento real de fotos ainda precisa ser implantado com controles de privacidade.
7. **Restaurar cancelados:** no Master, utilize o botão Restaurar inscrição em inscrições canceladas/expiradas. Uma vaga paga só é restaurada se houver capacidade; nunca há overbooking automático.
8. **Convocações:** ao confirmar o pagamento ou cancelar a reserva, o aviso sai da lista ativa de convocações. A movimentação fica registrada no Histórico.
9. **Histórico administrativo:** aba Histórico registra movimentos novos de inscrições, pagamentos, cancelamentos, promoção da fila, alteração de partida, sorteios e resultados.
10. **Lotação paga:** se todos os jogadores de linha pagaram, o membro recebe aviso de lotação. Até o prazo final da partida, pode registrar interesse **apenas histórico**, sem cobrar Pix, sem vaga e sem entrar na fila automática.

## Como testar agora

- Abra https://benitezfilho.github.io/futebol-de-sabado/
- Use **Admin Master** (painel simulado, sem senha de produção).
- Entre em **Sorteio dos times**. São necessários cinco jogadores de linha pagos para cada time. Para quatro times, é preciso ter pelo menos 20 pagos; jogadores goleiros não contam.
- Confira **Reservas da linha**, **Goleiros coringas**, **Resultado do jogo** e **Histórico de rodízio**.
- Na aba **Jogadores**, teste cancelar e depois **Restaurar inscrição**, verificando o controle de capacidade.
- Na aba **Histórico**, consulte os eventos recentes. O histórico começa na V8 e não recria movimentos anteriores.
- Como membro da demonstração, abra **Editar perfil** para adicionar foto. Não utilize dados ou fotografias reais na demonstração pública.

## O que ainda não está em produção

**A V8 continua sendo uma demonstração de navegador.** Login SMS, Pix, upload remoto de fotos, compartilhamento de cadastros entre celulares e automação permanente dependem da API real, banco D1, autenticação e hospedagem. A configuração inicial dessa infraestrutura está em [cloudflare/](../cloudflare/).

A migração [0002_match_features.sql](../cloudflare/migrations/0002_match_features.sql) prepara o banco D1 para times, reservas, resultados, votos, estatísticas, interesses e notificações, mas não ativa sozinho os endpoints nem a interface de produção.

A integração Pix automática permanece suspensa conforme decisão dos responsáveis.
