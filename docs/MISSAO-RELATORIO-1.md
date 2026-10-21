# Missão «estratégia original» — relatório 1 (Ciclos 1–3)

Data: 2026-10-21. Auditoria e plano: `docs/MISSAO-AUDITORIA.md`. Pré-registos (escritos antes de cada corrida): `PREREGISTO-CICLO1.md` (+Adenda 1), `PREREGISTO-CICLO2.md` (+Adenda 1), `PREREGISTO-CICLO3.md`. Resultados brutos: branch `lab-results`, pastas `ciclo1/`, `ciclo2/`, `ciclo3/`.

## Conclusão

**Nenhuma estratégia validada.** Em três ciclos com arquiteturas diferentes (previsão conjunta com limiar de custo; funding como informação nova; carteira neutra ao mercado), sobre ~7 anos e 41–42 moedas líquidas, não há vantagem líquida de custos demonstrada. Nenhum candidato chegou a ser aprovado; o único finalista (Ciclo 1) falhou o teste final.

## O que se fez

| Ciclo | Ideia original | Dados novos | Resultado |
|---|---|---|---|
| 1 | Um modelo linear único para todas as moedas (walk-forward com purga, sem ajustar nada aos dados), operando **só quando o movimento previsto excede k × custo**. Informação cruzada: posição relativa e regime do BTC. | 42 moedas, 7 anos de velas de 1 h (2,5 M linhas) | Correlação OOS 0,01–0,03. 1 finalista (1 h, h = 6, k = 3: +24,7 bps em DEV+VAL) → **TEST −8,4 bps**, falha. |
| 2 | Funding dos perpétuos (posicionamento) como característica, com o funding pago/recebido contado no custo. | Funding Binance desde 2019 (ficheiros públicos mensais) | **Não acrescenta nada** (correlação 0,023 com vs 0,025 sem funding). Nenhum finalista. |
| 3 | Carteira **neutra** (compra os 20 % melhores, vende os 20 % piores, valor igual): retira a deriva e o risco comum, aumenta o poder. | Os mesmos | Spread bruto +9 bps (1 h), +15 bps (4 h), +47 a +54 bps (1 d) contra custo de 24 bps; líquido −15 / −9 / +24…+32 bps (1 d, **não significativo**). Nenhum finalista. |

## Principais achados (todos medidos)

1. **Existe informação direcional fraca, só nas caudas, a 1 h:** o decil mais alto prevê +16 bps realizados e o mais baixo −18 bps. É pequena face a 12 bps por posição e instável no tempo (forte em 2020–21, ≈ 0 depois).
2. **Parte do «bruto positivo» é deriva do universo (sobreviventes):** no controlo negativo a 1 d (Ciclo 1) o bruto foi **maior** que o do modelo real. Por isso se acrescentou o critério «ganho face a sempre comprado» (Adenda 1 do Ciclo 2). A 1 h o ganho face a sempre comprado é real (+10 a +18 bps) mas não paga os custos.
3. **O funding não prevê** retornos (modelo só com funding: correlação ≈ 0 ou negativa).
4. **A carteira neutra a 1 h e 4 h está bem medida e é negativa** (intervalos de confiança estreitos: o spread real ronda +9 / +15 bps contra 24 bps de custo).
5. **A 1 d (5 e 10 dias) não é possível concluir:** erro-padrão ≈ 30 bps por coorte, vantagem mínima detetável ≈ 70 bps, com só 126–250 coortes independentes em 7 anos. Um spread bruto de ~50 bps é compatível tanto com ruído como com vantagem real. **Mais moedas ajudam pouco; só mais anos ajudariam**, e a história pública acaba aqui.

## Contagem de hipóteses (controlo de testes múltiplos)

Decisão: 16 (Ciclo 1) + 16 (Ciclo 2) + 15 (Ciclo 3) = **47 configurações**, com Holm cumulativo (as anteriores entram com p = 1). Antes: 1 655 experiências (Fase 1) + 10 hipóteses pré-registadas (Fase 2). Tudo contado; nada escondido.

## Limitações

Universo de sobreviventes; preços spot Binance como proxy de perpétuos Hyperliquid; funding da Binance (a Hyperliquid cobra de hora a hora com outras taxas); custo fixo de 12 bps (sem profundidade do book nem impacto); o TEST é partilhado entre ciclos (declarado); carteiras de ~8+8 posições não são executáveis com 10 USD (ordens mínimas); nenhum dado de ouro/EUR em quantidade (2 de 42 moedas).

## O que isto implica para o bot e para os 10 USD

- **Não há base para esperar lucro.** Nada do que foi testado aguenta custos com evidência independente.
- As proteções do bot, `HL_LIVE`, `SOL_LIVE` e `HL_AUTOPILOT` ficam como estavam (desligados). Nada foi alterado em produção.

## O que ainda se pode investigar (e o que não)

| Opção | Valor esperado | Custo |
|---|---|---|
| Ciclo 4: universo mais largo (~150 moedas) | Melhora o poder a 1 h/4 h (já bem medidos e negativos); quase não ajuda a 1 d | ~40 min de dados, 1 corrida |
| **Recolha prospetiva** de funding, open interest, livro de ordens e fills reais da Hyperliquid durante meses (job agendado) | Única forma de testar open interest/posicionamento e **execução maker**, que o histórico público não tem | Tempo (meses), sem risco |
| Paper trading do melhor candidato fraco (carteira neutra 1 d h = 10) | Acumula evidência fora da amostra; poder baixo (mesmo problema) | Meses |
| Execução maker (custo 12 → ~3–6 bps) | Poderia transformar os +9…+19 bps brutos a 1 h em positivo; **só medível com fills reais**, por causa da seleção adversa | Demo/testnet |
| Mais variações de parâmetros ou de modelo | Quase nenhum: aumenta falsos positivos sem aumentar o poder | — |

Nenhuma destas opções promete lucro; a segunda e a quarta são as que podem trazer informação que o histórico público não tem.
