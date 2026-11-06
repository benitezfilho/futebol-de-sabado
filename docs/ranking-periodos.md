# Ranking por períodos: abrir, encerrar e reabrir (demonstração)

## Acesso

Abra https://benitezfilho.github.io/futebol-de-sabado/ e entre em **Admin Master → Ranking / Períodos**.

## Regras

- O Master pode criar quantos períodos desejar, por exemplo "Ranking Outubro 2026" ou "Ranking do Futebol 2026".
- Cada período tem **nome, data inicial e data final**, com ambas as datas incluídas. Pode usar datas passadas. O fuso de referência das partidas é **America/Sao_Paulo**.
- **Rascunho:** período salvo, ainda não divulgado nem calculado. Pode editar as datas antes de abrir.
- **Aberto:** ranking é recalculado com gols, assistências, presença e MVP de partidas cujas datas estejam dentro do período. Pode editar nome e datas, inclusive retroativamente.
- **Encerrar e congelar:** o Master encerra quando quiser, mesmo antes da data final. O sistema guarda uma **cópia da classificação** na data de encerramento. As mudanças posteriores de pontuação não alteram esse resultado congelado.
- **Reabrir:** o Master reabre mesmo um período antigo, corrige estatísticas e datas, e pode encerrar novamente para registrar uma nova versão.
- **Histórico:** aberturas, fechamentos, alterações de datas e reaberturas são registradas no histórico da demonstração. Versões antigas de fechamento são preservadas.
- **Consulta pública:** em **Ranking**, os jogadores selecionam o período que querem consultar e identificam se está aberto ou encerrado. Rascunhos aparecem identificados, sem ranking publicado.
- O processo de ranking não altera a capacidade de 22 jogadores, a classificação dos 10 primeiros pagantes, as inscrições, o Pix ou o calendário da partida.
- **MVP:** uma premiação de 5 pontos é contabilizada quando há um vencedor único na votação de uma partida. Empate na votação não escolhe MVP automaticamente.

## Exemplo prático: outubro retroativo

1. Admin Master → Ranking / Períodos → **+ Novo período de ranking**.
2. Nome: **Ranking Outubro 2026**.
3. Data inicial: **01/10/2026**; final: **31/10/2026**.
4. Salve. Ele aparece como **Rascunho**.
5. Clique em **Abrir ranking**. As partidas de outubro com resultados registrados serão consideradas.
6. Se precisar, edite as datas ou as estatísticas dos jogos.
7. Clique em **Encerrar e congelar ranking** quando quiser.
8. Para corrigir depois, clique em **Reabrir ranking**, ajuste as informações e encerre novamente.

## Limitações atuais

**Isto ainda é demonstração no navegador.** O calendário e as cópias de classificação ficam no localStorage do navegador; não sincronizam entre computadores/celulares nem fazem alterações no D1. Não use a interface como registro definitivo de premiações.

O esquema do banco para produção está preparado em [0003_ranking_periods.sql](../cloudflare/migrations/0003_ranking_periods.sql), mas **a API real de rankings, a autenticação Master e o site compartilhado ainda precisam ser conectados e homologados**.

O Pix automático permanece em stand-by.
