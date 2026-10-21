<!-- Relatório gerado por scripts/audit-real.mjs (workflow «Auditoria em dados reais», execução 39586632792, commit 484704f, 2026-10-21 10:43 UTC).
     Dados: velas públicas da Hyperliquid (xyz:GOLD, xyz:SP500, xyz:EUR) e da Binance (PAXGUSDT, EURUSDT). Na linha «antes de custos / custos» o funding aparece
     como custo: valor negativo = funding recebido. Para repetir: node scripts/audit-real.mjs. -->

# Auditoria quantitativa em dados reais — 2026-10-21T10:43:17.369Z

Motor: grokbot/backtest.js (o mesmo da app). Custos: taxa 9 bps (taker) / 3 bps (maker), slippage 3 bps (stop 5 bps), conta $10 000, risco 1% por trade, alavancagem máx. 5×, paragens −20% / −5% dia. Execução: sinal ao fecho da vela, ordem a mercado à abertura seguinte.

## 0. Qualidade dos dados

| conjunto | mercado | velas | de | até | fora de ordem | duplicadas | lacunas (máx. velas) | velas inválidas |
|---|---|---|---|---|---|---|---|---|
| HL-15m | xyz:GOLD | 4995 | 2026-08-30 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-15m | xyz:SP500 | 4995 | 2026-08-30 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-15m | xyz:EUR | 4995 | 2026-08-30 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-1h | xyz:GOLD | 4995 | 2026-03-27 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-1h | xyz:SP500 | 4995 | 2026-03-27 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-1h | xyz:EUR | 4995 | 2026-03-27 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-4h | xyz:GOLD | 1817 | 2025-12-22 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-4h | xyz:SP500 | 1301 | 2026-03-18 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| HL-4h | xyz:EUR | 1810 | 2025-12-23 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| BIN-1h | PAXGUSDT (Binance) | 29999 | 2023-05-20 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| BIN-1h | EURUSDT (Binance) | 29999 | 2023-05-20 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| BIN-4h | PAXGUSDT (Binance) | 13469 | 2020-08-28 | 2026-10-21 | 0 | 0 | 0 (0) | 0 |
| BIN-4h | EURUSDT (Binance) | 14897 | 2020-01-03 | 2026-10-21 | 0 | 0 | 1 (2) | 0 |
| BIN-1d | PAXGUSDT (Binance) | 2245 | 2020-08-28 | 2026-10-20 | 0 | 0 | 0 (0) | 0 |
| BIN-1d | EURUSDT (Binance) | 2483 | 2020-01-03 | 2026-10-20 | 0 | 0 | 0 (0) | 0 |

## 1. Rompimento 15 min  [HL-15m]

#### Rompimento 15 min
Período 2026-08-30 → 2026-10-21 (52 dias) · mercados: GOLD 4995 velas, SPX 4995 velas, EURUSD 4995 velas · funding real (parcial)

| métrica | valor |
|---|---|
| trades (fechadas) | 0 (0G 0P) · abertas no fim: 0 |
| taxa de acerto | — |
| ganhos brutos / perdas brutas | $0.00 / $0.00 |
| resultado líquido | $0.00 (0.0%) |
| fator de lucro | — |
| ganho médio / perda média / relação | — / — / — |
| expectativa por trade | — · — R (R ponderado pelo risco —) |
| incerteza da expectativa em R | desvio — · IC95% por blocos [—, —] · P(média>0) — · t — (n=0) |
| antes de custos / custos | — R / — R por trade · taxas $0.00 · slippage $0.00 · funding (custo; negativo = recebido) $0.00 |
| queda máxima | $0.00 (0.0%) · maior sequência de perdas 0 |
| comprar e manter | GOLD -7.7% · SPX -0.0% · EURUSD -3.1% |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 14835 | 99.0% |
| aquecimento (velas insuficientes) | 150 | 1.0% |
| sinal aceite | 0 | 0.0% |

Sinais → ordens → execuções → trades: 0 → 0 → 0 → 0. Sinais que o filtro de custo bloqueou: 1140 (535 compra, 605 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. GOLD: p10 0.01% · mediana 0.12% · p90 0.21% · velas acima do mínimo 0% | SPX: p10 0.02% · mediana 0.05% · p90 0.12% · velas acima do mínimo 0% | EURUSD: p10 0.01% · mediana 0.03% · p90 0.07% · velas acima do mínimo 0%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 0 | 0.0% | — | — | 0.0% |
| custo 2 bps | 98 | -20.7% | 0.52 | -0.31 | 22.1% |
| custo 15 bps | 0 | 0.0% | — | — | 0.0% |
| slippage 3× | 0 | 0.0% | — | — | 0.0% |
| sem slippage | 0 | 0.0% | — | — | 0.0% |
| sem filtro de custo | 532 | -90.3% | 0.06 | -3.97 | 90.3% |
| ordens limitadas | 0 | 0.0% | — | — | 0.0% |

Teste em duas partes da app (60/40): taker: A 0 trades — R · B 0 trades — R (t —) | maker: A 0 trades — R · B 0 trades — R (t —) → não passa

## 2. Day trade 4h  [HL-4h]

#### Day trade 4h
Período 2025-12-22 → 2026-10-21 (303 dias) · mercados: GOLD 1817 velas, SPX 1301 velas, EURUSD 1810 velas · funding real (parcial)

| métrica | valor |
|---|---|
| trades (fechadas) | 71 (33G 38P) · abertas no fim: 0 |
| taxa de acerto | 46% |
| ganhos brutos / perdas brutas | $2279.75 / -$2448.47 |
| resultado líquido | -$168.72 (-1.7%) |
| fator de lucro | 0.93 |
| ganho médio / perda média / relação | $69.08 / -$64.43 / 1.07 |
| expectativa por trade | -$2.38 · -0.02 R (R ponderado pelo risco -0.02) |
| incerteza da expectativa em R | desvio 0.82 · IC95% por blocos [-0.18, +0.15] · P(média>0) 40% · t -0.21 (n=71) |
| antes de custos / custos | +0.12 R / 0.14 R por trade · taxas $735.21 · slippage $254.55 · funding (custo; negativo = recebido) -$1.14 |
| risco por trade ($ = 1 R) | mín $98.55 · mediana $101.76 · máx $106.66 (varia com a conta) · Σ R -1.46 · Σ $ -$168.72 · Σ $ ÷ risco médio -1.65 R |
| queda máxima | $834.87 (7.8%) · maior sequência de perdas 5 |
| comprar e manter | GOLD -6.7% · SPX 17.1% · EURUSD -4.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| GOLD | 64 | 50% | -$12.23 | +0.00 |
| SPX | 7 | 14% | -$156.49 | -0.22 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| fim do dia | 47 | 49% | -$123.25 | -0.02 |
| stop-loss | 14 | 0% | -$1552.57 | -1.08 |
| take-profit | 10 | 100% | $1507.11 | +1.48 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 26 | 50% | $263.71 | +0.10 |
| EUA 13-21 UTC | 26 | 50% | -$224.61 | -0.08 |
| Europa 08-13 UTC | 19 | 37% | -$207.82 | -0.11 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 23 | 57% | $12.07 | +0.01 |
| ATR baixo (1/3 inferior) | 24 | 50% | $622.96 | +0.26 |
| ATR médio | 24 | 33% | -$803.75 | -0.33 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2026-01 | 9 | 67% | $307.81 | +0.34 |
| 2026-02 | 9 | 56% | -$109.73 | -0.11 |
| 2026-03 | 10 | 70% | $395.29 | +0.38 |
| 2026-04 | 9 | 22% | -$272.17 | -0.29 |
| 2026-05 | 5 | 20% | -$235.01 | -0.45 |
| 2026-06 | 11 | 55% | $40.21 | +0.04 |
| 2026-07 | 4 | 0% | -$143.06 | -0.35 |
| 2026-08 | 7 | 57% | $61.29 | +0.09 |
| 2026-09 | 6 | 33% | -$189.48 | -0.32 |
| 2026-10 | 1 | 0% | -$23.87 | -0.24 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 3514 | 71.3% |
| sem rompimento | 1041 | 21.1% |
| aquecimento (velas insuficientes) | 150 | 3.0% |
| posição ou ordem já aberta neste mercado | 140 | 2.8% |
| volatilidade extrema | 12 | 0.2% |
| sinal aceite | 71 | 1.4% |

Sinais → ordens → execuções → trades: 71 → 71 → 71 → 71. Sinais que o filtro de custo bloqueou: 232 (121 compra, 111 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. GOLD: p10 0.33% · mediana 0.68% · p90 1.15% · velas acima do mínimo 61% | EURUSD: p10 0.11% · mediana 0.18% · p90 0.29% · velas acima do mínimo 0% | SPX: p10 0.22% · mediana 0.35% · p90 0.60% · velas acima do mínimo 10%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 71 | -1.7% | 0.93 | -0.02 | 7.8% |
| custo 2 bps | 229 | -6.0% | 0.92 | -0.04 | 13.8% |
| custo 15 bps | 19 | -0.5% | 0.92 | -0.02 | 2.8% |
| slippage 3× | 71 | -6.1% | 0.77 | -0.09 | 10.4% |
| sem slippage | 71 | 0.4% | 1.02 | +0.01 | 6.5% |
| sem filtro de custo | 236 | -39.5% | 0.52 | -0.32 | 40.6% |
| ordens limitadas | 67 | -1.0% | 0.95 | -0.01 | 7.2% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2026-05-22 · validação até 2026-08-06 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 40 / +0.07 | 20 / -0.05 [-0.27, +0.16] | ref. | 11 / -0.27 [-0.47, -0.06] · t -1.55 |
| D1 | sem alvo (só stop ou fim do dia) | 35 / -0.01 | 18 / -0.01 [-0.28, +0.26] | não | não calculado |
| D2 | alvo 2×ATR (em vez de 3) | 44 / +0.05 | 22 / -0.00 [-0.26, +0.24] | não | não calculado |
| D3 | stop 3×ATR (em vez de 2) | 64 / +0.02 | 32 / -0.05 [-0.21, +0.09] | não | não calculado |
| D4 | rompimento de 40 velas (em vez de 20) | 33 / +0.09 | 18 / +0.01 [-0.23, +0.24] | sim | 10 / -0.27 [-0.42, -0.13] · t -1.42 |

Teste em duas partes da app (60/40): taker: A 50 trades +0.03 R · B 21 trades -0.14 R (t -1.06) | maker: A 47 trades -0.01 R · B 20 trades -0.02 R (t -0.14) → não passa

## 3. Swing 4h  [HL-4h]

#### Swing 4h
Período 2025-12-22 → 2026-10-21 (303 dias) · mercados: GOLD 1817 velas, SPX 1301 velas, EURUSD 1810 velas · funding real (parcial)

| métrica | valor |
|---|---|
| trades (fechadas) | 38 (12G 26P) · abertas no fim: 0 |
| taxa de acerto | 32% |
| ganhos brutos / perdas brutas | $2165.54 / -$2180.02 |
| resultado líquido | -$14.47 (-0.1%) |
| fator de lucro | 0.99 |
| ganho médio / perda média / relação | $180.46 / -$83.85 / 2.15 |
| expectativa por trade | -$0.38 · +0.01 R (R ponderado pelo risco -0.00) |
| incerteza da expectativa em R | desvio 1.54 · IC95% por blocos [-0.40, +0.45] · P(média>0) 49% · t 0.03 (n=38) |
| antes de custos / custos | +0.17 R / 0.16 R por trade · taxas $438.85 · slippage $195.04 · funding (custo; negativo = recebido) -$11.34 |
| risco por trade ($ = 1 R) | mín $98.11 · mediana $102.33 · máx $109.38 (varia com a conta) · Σ R +0.30 · Σ $ -$14.47 · Σ $ ÷ risco médio -0.14 R |
| queda máxima | $1201.35 (10.9%) · maior sequência de perdas 9 |
| comprar e manter | GOLD -6.7% · SPX 17.1% · EURUSD -4.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| GOLD | 32 | 38% | $506.01 | +0.17 |
| SPX | 6 | 0% | -$520.48 | -0.83 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| stop-loss | 38 | 32% | -$14.47 | +0.01 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 11 | 36% | -$26.75 | +0.00 |
| EUA 13-21 UTC | 19 | 42% | $479.82 | +0.25 |
| Europa 08-13 UTC | 8 | 0% | -$467.55 | -0.57 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 12 | 42% | $680.17 | +0.56 |
| ATR baixo (1/3 inferior) | 13 | 31% | -$109.94 | -0.07 |
| ATR médio | 13 | 23% | -$584.70 | -0.43 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2026-01 | 3 | 100% | $483.90 | +1.61 |
| 2026-02 | 6 | 33% | -$118.61 | -0.19 |
| 2026-03 | 3 | 67% | $482.19 | +1.54 |
| 2026-04 | 7 | 0% | -$580.07 | -0.78 |
| 2026-05 | 4 | 25% | -$151.42 | -0.37 |
| 2026-06 | 4 | 50% | $134.59 | +0.34 |
| 2026-07 | 4 | 0% | -$439.93 | -1.09 |
| 2026-08 | 3 | 33% | $306.97 | +1.05 |
| 2026-09 | 3 | 33% | -$22.51 | -0.07 |
| 2026-10 | 1 | 0% | -$109.57 | -1.09 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 3386 | 68.7% |
| sem rompimento | 820 | 16.6% |
| posição ou ordem já aberta neste mercado | 522 | 10.6% |
| aquecimento (velas insuficientes) | 150 | 3.0% |
| volatilidade extrema | 12 | 0.2% |
| sinal aceite | 38 | 0.8% |

Sinais → ordens → execuções → trades: 38 → 38 → 38 → 38. Sinais que o filtro de custo bloqueou: 217 (112 compra, 105 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. GOLD: p10 0.32% · mediana 0.68% · p90 1.21% · velas acima do mínimo 59% | EURUSD: p10 0.11% · mediana 0.18% · p90 0.29% · velas acima do mínimo 0% | SPX: p10 0.22% · mediana 0.34% · p90 0.56% · velas acima do mínimo 7%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 38 | -0.1% | 0.99 | +0.01 | 10.9% |
| custo 2 bps | 124 | -17.1% | 0.73 | -0.21 | 25.9% |
| custo 15 bps | 10 | 2.7% | 1.64 | +0.28 | 3.4% |
| slippage 3× | 38 | -3.4% | 0.86 | -0.08 | 12.4% |
| sem slippage | 38 | 1.5% | 1.07 | +0.05 | 10.2% |
| sem filtro de custo | 134 | -34.9% | 0.52 | -0.48 | 37.9% |
| ordens limitadas | 38 | -0.6% | 0.97 | -0.00 | 10.4% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2026-05-22 · validação até 2026-08-06 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 22 / +0.09 | 10 / -0.14 [-0.76, +0.60] | ref. | 7 / -0.33 [—, —] · t -1.19 |
| S1 | stop móvel 4×ATR (em vez de 3): deixa a tendência respirar | 21 / -0.11 | 10 / -0.21 [-0.76, +0.43] | não | não calculado |
| S2 | EMA lenta 100 (em vez de 50): filtro de tendência mais lento | 15 / +0.42 | 9 / -0.00 [-0.67, +0.67] | não | não calculado |
| S3 | rompimento de 40 velas (em vez de 20): menos falsos rompimentos | 17 / +0.28 | 8 / +0.03 [-0.89, +0.94] | sim | 7 / -0.32 [—, —] · t -1.19 |
| S4 | stop inicial 3×ATR (em vez de 2) | 30 / +0.16 | 17 / -0.14 [-0.67, +0.36] | não | não calculado |

Teste em duas partes da app (60/40): taker: A 26 trades +0.11 R · B 13 trades -0.21 R (t -0.52) | maker: A 26 trades +0.08 R · B 13 trades -0.18 R (t -0.44) → não passa

## 4. Day trade 1h  [HL-1h]

#### Day trade 1h
Período 2026-03-27 → 2026-10-21 (208 dias) · mercados: GOLD 4995 velas, SPX 4995 velas, EURUSD 4995 velas · funding real (parcial)

| métrica | valor |
|---|---|
| trades (fechadas) | 11 (6G 5P) · abertas no fim: 0 |
| taxa de acerto | 55% |
| ganhos brutos / perdas brutas | $572.26 / -$387.01 |
| resultado líquido | $185.25 (1.9%) |
| fator de lucro | 1.48 |
| ganho médio / perda média / relação | $95.38 / -$77.40 / 1.23 |
| expectativa por trade | $16.84 · +0.17 R (R ponderado pelo risco +0.17) |
| incerteza da expectativa em R | desvio 1.04 · IC95% por blocos [-0.14, +0.51] · P(média>0) 86% · t 0.55 (n=11) |
| antes de custos / custos | +0.34 R / 0.17 R por trade · taxas $135.55 · slippage $47.04 · funding (custo; negativo = recebido) $2.34 |
| risco por trade ($ = 1 R) | mín $97.81 · mediana $100.00 · máx $101.76 (varia com a conta) · Σ R +1.89 · Σ $ $185.25 · Σ $ ÷ risco médio +1.85 R |
| queda máxima | $225.41 (2.3%) · maior sequência de perdas 2 |
| comprar e manter | GOLD -7.6% · SPX 18.6% · EURUSD -2.7% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| GOLD | 10 | 60% | $210.47 | +0.21 |
| SPX | 1 | 0% | -$25.22 | -0.25 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| fim do dia | 4 | 75% | $101.34 | +0.26 |
| stop-loss | 3 | 0% | -$330.95 | -1.10 |
| take-profit | 3 | 100% | $440.08 | +1.48 |
| time-stop | 1 | 0% | -$25.22 | -0.25 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 5 | 40% | $47.28 | +0.10 |
| EUA 13-21 UTC | 5 | 80% | $248.46 | +0.50 |
| Europa 08-13 UTC | 1 | 0% | -$110.50 | -1.11 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 3 | 33% | -$174.92 | -0.58 |
| ATR baixo (1/3 inferior) | 4 | 75% | $339.41 | +0.86 |
| ATR médio | 4 | 50% | $20.76 | +0.05 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2026-03 | 3 | 33% | -$142.01 | -0.47 |
| 2026-04 | 5 | 40% | $124.03 | +0.26 |
| 2026-06 | 2 | 100% | $193.87 | +0.97 |
| 2026-08 | 1 | 100% | $9.36 | +0.09 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 13988 | 93.3% |
| janela sem entradas (day trade: últimas horas do dia) | 619 | 4.1% |
| aquecimento (velas insuficientes) | 144 | 1.0% |
| sem rompimento | 119 | 0.8% |
| posição ou ordem já aberta neste mercado | 104 | 0.7% |
| sinal aceite | 11 | 0.1% |

Sinais → ordens → execuções → trades: 11 → 11 → 11 → 11. Sinais que o filtro de custo bloqueou: 989 (517 compra, 472 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. GOLD: p10 0.05% · mediana 0.31% · p90 0.47% · velas acima do mínimo 3% | SPX: p10 0.09% · mediana 0.16% · p90 0.30% · velas acima do mínimo 0% | EURUSD: p10 0.04% · mediana 0.08% · p90 0.13% · velas acima do mínimo 0%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 11 | 1.9% | 1.48 | +0.17 | 2.3% |
| custo 2 bps | 311 | -44.5% | 0.63 | -0.24 | 46.3% |
| custo 15 bps | 0 | 0.0% | — | — | 0.0% |
| slippage 3× | 11 | 1.2% | 1.28 | +0.11 | 2.4% |
| sem slippage | 11 | 2.2% | 1.60 | +0.20 | 2.2% |
| sem filtro de custo | 628 | -92.0% | 0.28 | -1.27 | 92.0% |
| ordens limitadas | 11 | 2.2% | 1.59 | +0.20 | 2.3% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2026-07-09 · validação até 2026-08-30 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 10 / +0.18 | 1 / +0.09 [—, —] | ref. | 0 / — [—, —] · t — |
| D1 | sem alvo (só stop ou fim do dia) | 8 / +0.33 | 1 / +0.09 [—, —] | não | não calculado |
| D2 | alvo 2×ATR (em vez de 3) | 10 / +0.08 | 1 / +0.09 [—, —] | não | não calculado |
| D3 | stop 3×ATR (em vez de 2) | 48 / -0.10 | 12 / -0.29 [-0.50, -0.05] | não | não calculado |
| D4 | rompimento de 40 velas (em vez de 20) | 10 / +0.18 | 1 / +0.09 [—, —] | não | não calculado |

Teste em duas partes da app (60/40): taker: A 10 trades +0.18 R · B 1 trades +0.09 R (t —) | maker: A 10 trades +0.21 R · B 1 trades +0.16 R (t —) → não passa

## 5. Day trade 4h (histórico longo)  [BIN-4h]

#### Day trade 4h (histórico longo)
Período 2020-01-03 → 2026-10-21 (2483 dias) · mercados: GOLD 13469 velas, EURUSD 14897 velas · funding não incluído

| métrica | valor |
|---|---|
| trades (fechadas) | 289 (107G 182P) · abertas no fim: 0 |
| taxa de acerto | 37% |
| ganhos brutos / perdas brutas | $3823.06 / -$7351.85 |
| resultado líquido | -$3528.79 (-35.3%) |
| fator de lucro | 0.52 |
| ganho médio / perda média / relação | $35.73 / -$40.39 / 0.88 |
| expectativa por trade | -$12.21 · -0.15 R (R ponderado pelo risco -0.16) |
| incerteza da expectativa em R | desvio 0.67 · IC95% por blocos [-0.21, -0.08] · P(média>0) 0% · t -3.76 (n=289) |
| antes de custos / custos | +0.01 R / 0.15 R por trade · taxas $2506.26 · slippage $879.80 · funding (custo; negativo = recebido) $0.00 |
| risco por trade ($ = 1 R) | mín $63.80 · mediana $71.89 · máx $100.27 (varia com a conta) · Σ R -42.84 · Σ $ -$3528.79 · Σ $ ÷ risco médio -46.37 R |
| queda máxima | $3683.79 (36.7%) · maior sequência de perdas 17 |
| comprar e manter | GOLD 112.3% · EURUSD 0.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| EURUSD | 27 | 44% | -$759.89 | -0.30 |
| GOLD | 262 | 36% | -$2768.90 | -0.13 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| fim do dia | 214 | 41% | -$1042.99 | -0.06 |
| stop-loss | 55 | 0% | -$4521.38 | -1.09 |
| take-profit | 20 | 100% | $2035.58 | +1.48 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 101 | 36% | -$1733.64 | -0.20 |
| EUA 13-21 UTC | 112 | 36% | -$915.82 | -0.11 |
| Europa 08-13 UTC | 76 | 41% | -$879.33 | -0.15 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 96 | 42% | -$1448.15 | -0.19 |
| ATR baixo (1/3 inferior) | 97 | 33% | -$1367.86 | -0.17 |
| ATR médio | 96 | 36% | -$712.78 | -0.09 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2020-03 | 5 | 60% | -$76.68 | -0.15 |
| 2020-04 | 3 | 67% | -$98.00 | -0.33 |
| 2020-05 | 4 | 25% | -$190.11 | -0.49 |
| 2020-06 | 2 | 50% | -$103.84 | -0.54 |
| 2020-08 | 1 | 0% | -$106.17 | -1.11 |
| 2020-09 | 3 | 33% | -$44.53 | -0.16 |
| 2020-10 | 5 | 20% | -$175.19 | -0.38 |
| 2020-11 | 5 | 40% | -$165.07 | -0.36 |
| 2020-12 | 4 | 75% | -$47.02 | -0.13 |
| 2021-01 | 5 | 80% | $54.56 | +0.12 |
| 2021-02 | 5 | 80% | $60.46 | +0.13 |
| 2021-03 | 6 | 17% | -$196.68 | -0.36 |
| 2021-04 | 7 | 0% | -$323.58 | -0.53 |
| 2021-05 | 7 | 57% | -$3.15 | -0.00 |
| 2021-06 | 6 | 50% | -$61.77 | -0.12 |
| 2021-08 | 4 | 25% | -$102.30 | -0.30 |
| 2021-09 | 1 | 100% | $40.57 | +0.48 |
| 2021-10 | 1 | 0% | -$12.57 | -0.15 |
| 2021-11 | 5 | 20% | -$84.51 | -0.20 |
| 2021-12 | 1 | 0% | -$24.09 | -0.29 |
| 2022-01 | 5 | 0% | -$110.13 | -0.27 |
| 2022-02 | 8 | 25% | -$171.60 | -0.26 |
| 2022-03 | 6 | 50% | $93.82 | +0.20 |
| 2022-04 | 2 | 0% | -$44.65 | -0.27 |
| 2022-05 | 7 | 0% | -$320.86 | -0.57 |
| 2022-06 | 1 | 0% | -$7.44 | -0.10 |
| 2022-07 | 6 | 0% | -$263.68 | -0.57 |
| 2022-09 | 2 | 50% | $4.07 | +0.03 |
| 2022-10 | 1 | 0% | -$17.06 | -0.23 |
| 2022-11 | 7 | 14% | -$138.73 | -0.27 |
| 2022-12 | 3 | 0% | -$96.34 | -0.44 |
| 2023-02 | 2 | 0% | -$97.79 | -0.67 |
| 2023-03 | 3 | 67% | $29.55 | +0.14 |
| 2023-04 | 1 | 0% | -$17.12 | -0.24 |
| 2023-05 | 1 | 100% | $105.95 | +1.48 |
| 2023-06 | 1 | 0% | -$80.73 | -1.11 |
| 2023-10 | 1 | 0% | -$4.64 | -0.06 |
| 2023-11 | 3 | 0% | -$55.59 | -0.26 |
| 2024-02 | 2 | 0% | -$99.23 | -0.70 |
| 2024-03 | 7 | 57% | $48.47 | +0.10 |
| 2024-04 | 10 | 60% | $145.56 | +0.21 |
| 2024-05 | 4 | 25% | -$84.70 | -0.29 |
| 2024-06 | 1 | 0% | -$21.42 | -0.30 |
| 2024-07 | 4 | 25% | -$32.98 | -0.12 |
| 2024-08 | 3 | 33% | -$48.11 | -0.23 |
| 2024-09 | 1 | 0% | -$2.57 | -0.04 |
| 2024-11 | 9 | 44% | -$103.23 | -0.16 |
| 2024-12 | 1 | 0% | -$77.19 | -1.11 |
| 2025-01 | 1 | 100% | $8.84 | +0.13 |
| 2025-02 | 4 | 75% | $46.53 | +0.17 |
| 2025-03 | 3 | 67% | $21.08 | +0.10 |
| 2025-04 | 10 | 50% | -$125.23 | -0.18 |
| 2025-05 | 7 | 14% | -$92.01 | -0.19 |
| 2025-06 | 2 | 50% | -$0.07 | -0.00 |
| 2025-09 | 1 | 0% | -$21.77 | -0.32 |
| 2025-10 | 9 | 33% | -$55.87 | -0.09 |
| 2025-11 | 5 | 20% | -$108.38 | -0.33 |
| 2025-12 | 1 | 0% | -$73.03 | -1.12 |
| 2026-01 | 8 | 75% | $117.35 | +0.23 |
| 2026-02 | 11 | 55% | -$112.89 | -0.15 |
| 2026-03 | 8 | 38% | $202.07 | +0.39 |
| 2026-04 | 5 | 40% | -$53.27 | -0.16 |
| 2026-05 | 5 | 20% | -$120.12 | -0.36 |
| 2026-06 | 9 | 67% | $106.38 | +0.18 |
| 2026-07 | 3 | 0% | -$58.59 | -0.30 |
| 2026-08 | 6 | 83% | $144.15 | +0.37 |
| 2026-09 | 8 | 13% | -$208.75 | -0.39 |
| 2026-10 | 1 | 0% | -$17.19 | -0.26 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 21345 | 75.2% |
| sem rompimento | 6015 | 21.2% |
| posição ou ordem já aberta neste mercado | 559 | 2.0% |
| aquecimento (velas insuficientes) | 100 | 0.4% |
| volatilidade extrema | 42 | 0.1% |
| proteção de capital ativa (sem novas entradas) | 16 | 0.1% |
| sinal aceite | 289 | 1.0% |

Sinais → ordens → execuções → trades: 289 → 289 → 289 → 289. Sinais que o filtro de custo bloqueou: 1367 (720 compra, 647 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. EURUSD: p10 0.12% · mediana 0.24% · p90 0.48% · velas acima do mínimo 6% | GOLD: p10 0.35% · mediana 0.56% · p90 0.95% · velas acima do mínimo 43%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 289 | -35.3% | 0.52 | -0.15 | 36.7% |
| custo 2 bps | 1161 | -77.3% | 0.53 | -0.16 | 78.3% |
| custo 15 bps | 58 | -12.7% | 0.30 | -0.23 | 13.1% |
| slippage 3× | 289 | -50.7% | 0.34 | -0.24 | 50.9% |
| sem slippage | 289 | -27.9% | 0.61 | -0.11 | 30.6% |
| sem filtro de custo | 1260 | -97.8% | 0.23 | -0.44 | 97.8% |
| ordens limitadas | 283 | -24.0% | 0.65 | -0.09 | 26.6% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2023-05-28 · validação até 2025-02-07 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 135 / -0.23 | 50 / -0.11 [-0.25, +0.04] | ref. | 104 / -0.06 [-0.19, +0.08] · t -0.76 |
| D1 | sem alvo (só stop ou fim do dia) | 132 / -0.26 | 49 / -0.20 [-0.34, -0.06] | não | não calculado |
| D2 | alvo 2×ATR (em vez de 3) | 138 / -0.22 | 53 / -0.12 [-0.24, +0.00] | não | não calculado |
| D3 | stop 3×ATR (em vez de 2) | 260 / -0.16 | 119 / -0.15 [-0.22, -0.08] | não | não calculado |
| D4 | rompimento de 40 velas (em vez de 20) | 117 / -0.25 | 47 / -0.15 [-0.29, -0.00] | não | não calculado |

Teste em duas partes da app (60/40): taker: A 140 trades -0.24 R · B 149 trades -0.06 R (t -1.03) | maker: A 139 trades -0.18 R · B 144 trades -0.01 R (t -0.20) → não passa

## 6. Swing 4h (histórico longo)  [BIN-4h]

#### Swing 4h (histórico longo)
Período 2020-01-03 → 2026-10-21 (2483 dias) · mercados: GOLD 13469 velas, EURUSD 14897 velas · funding não incluído

| métrica | valor |
|---|---|
| trades (fechadas) | 171 (55G 116P) · abertas no fim: 0 |
| taxa de acerto | 32% |
| ganhos brutos / perdas brutas | $5113.57 / -$7629.58 |
| resultado líquido | -$2516.01 (-25.2%) |
| fator de lucro | 0.67 |
| ganho médio / perda média / relação | $92.97 / -$65.77 / 1.41 |
| expectativa por trade | -$14.71 · -0.16 R (R ponderado pelo risco -0.19) |
| incerteza da expectativa em R | desvio 1.20 · IC95% por blocos [-0.33, +0.02] · P(média>0) 4% · t -1.77 (n=171) |
| antes de custos / custos | +0.01 R / 0.17 R por trade · taxas $1574.61 · slippage $681.32 · funding (custo; negativo = recebido) $0.00 |
| risco por trade ($ = 1 R) | mín $67.76 · mediana $74.71 · máx $100.00 (varia com a conta) · Σ R -27.71 · Σ $ -$2516.01 · Σ $ ÷ risco médio -32.51 R |
| queda máxima | $3269.61 (32.5%) · maior sequência de perdas 21 |
| comprar e manter | GOLD 112.3% · EURUSD 0.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| EURUSD | 19 | 26% | -$876.51 | -0.49 |
| GOLD | 152 | 33% | -$1639.50 | -0.12 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| kill-switch | 1 | 0% | -$35.30 | -0.44 |
| stop-loss | 150 | 26% | -$3721.72 | -0.29 |
| time-stop | 20 | 80% | $1241.00 | +0.83 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 38 | 21% | -$1207.64 | -0.41 |
| EUA 13-21 UTC | 90 | 38% | -$406.97 | -0.02 |
| Europa 08-13 UTC | 43 | 30% | -$901.40 | -0.23 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 56 | 32% | -$546.00 | -0.08 |
| ATR baixo (1/3 inferior) | 58 | 22% | -$1599.53 | -0.34 |
| ATR médio | 57 | 42% | -$370.47 | -0.05 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2020-03 | 3 | 0% | -$226.23 | -0.76 |
| 2020-04 | 1 | 0% | -$107.33 | -1.10 |
| 2020-05 | 2 | 0% | -$156.71 | -0.81 |
| 2020-06 | 2 | 0% | -$120.38 | -0.63 |
| 2020-08 | 1 | 0% | -$104.59 | -1.11 |
| 2020-09 | 1 | 0% | -$101.10 | -1.09 |
| 2020-10 | 3 | 0% | -$215.93 | -0.79 |
| 2020-11 | 4 | 0% | -$288.86 | -0.81 |
| 2020-12 | 4 | 0% | -$252.95 | -0.74 |
| 2021-01 | 3 | 100% | $185.36 | +0.73 |
| 2021-02 | 2 | 50% | -$24.86 | -0.14 |
| 2021-03 | 3 | 33% | -$57.69 | -0.22 |
| 2021-04 | 6 | 17% | -$314.99 | -0.62 |
| 2021-05 | 2 | 100% | $171.95 | +1.04 |
| 2021-06 | 4 | 25% | -$167.43 | -0.50 |
| 2021-08 | 1 | 100% | $92.24 | +1.12 |
| 2021-09 | 2 | 50% | -$1.37 | -0.01 |
| 2021-10 | 1 | 0% | -$86.08 | -1.04 |
| 2021-11 | 2 | 50% | $131.25 | +0.80 |
| 2021-12 | 2 | 0% | -$131.87 | -0.79 |
| 2022-01 | 3 | 0% | -$212.74 | -0.87 |
| 2022-02 | 4 | 50% | $36.33 | +0.12 |
| 2022-03 | 3 | 33% | $69.64 | +0.30 |
| 2022-04 | 1 | 0% | -$51.57 | -0.64 |
| 2022-05 | 4 | 0% | -$292.36 | -0.92 |
| 2022-06 | 1 | 0% | -$83.38 | -1.07 |
| 2022-07 | 3 | 33% | $35.75 | +0.17 |
| 2022-09 | 2 | 0% | -$84.88 | -0.55 |
| 2022-10 | 1 | 0% | -$84.48 | -1.11 |
| 2022-11 | 5 | 40% | -$176.76 | -0.47 |
| 2022-12 | 2 | 0% | -$137.65 | -0.94 |
| 2023-02 | 1 | 100% | $190.23 | +2.63 |
| 2023-03 | 3 | 0% | -$93.11 | -0.42 |
| 2023-04 | 1 | 0% | -$57.44 | -0.78 |
| 2023-05 | 1 | 0% | -$0.94 | -0.01 |
| 2023-06 | 1 | 0% | -$80.63 | -1.11 |
| 2023-10 | 1 | 0% | -$7.32 | -0.10 |
| 2023-11 | 2 | 50% | -$44.88 | -0.31 |
| 2024-02 | 2 | 0% | -$158.33 | -1.11 |
| 2024-03 | 2 | 50% | $101.02 | +0.73 |
| 2024-04 | 6 | 50% | -$19.65 | -0.04 |
| 2024-05 | 2 | 100% | $172.40 | +1.22 |
| 2024-06 | 1 | 0% | -$79.78 | -1.10 |
| 2024-07 | 3 | 33% | -$82.80 | -0.38 |
| 2024-08 | 3 | 33% | -$66.08 | -0.31 |
| 2024-09 | 1 | 100% | $21.19 | +0.30 |
| 2024-11 | 4 | 50% | $10.98 | +0.04 |
| 2024-12 | 1 | 0% | -$78.26 | -1.11 |
| 2025-01 | 1 | 100% | $123.79 | +1.78 |
| 2025-02 | 1 | 100% | $45.17 | +0.64 |
| 2025-03 | 2 | 100% | $109.16 | +0.76 |
| 2025-04 | 5 | 40% | $25.14 | +0.09 |
| 2025-05 | 4 | 25% | -$125.66 | -0.43 |
| 2025-06 | 1 | 0% | -$71.77 | -1.00 |
| 2025-07 | 1 | 0% | -$2.11 | -0.03 |
| 2025-09 | 1 | 100% | $82.06 | +1.16 |
| 2025-10 | 6 | 33% | -$65.11 | -0.14 |
| 2025-11 | 3 | 0% | -$190.76 | -0.90 |
| 2025-12 | 2 | 50% | -$44.51 | -0.32 |
| 2026-01 | 3 | 67% | $237.02 | +1.17 |
| 2026-02 | 6 | 50% | $46.59 | +0.12 |
| 2026-03 | 2 | 100% | $493.73 | +3.41 |
| 2026-04 | 4 | 0% | -$210.11 | -0.70 |
| 2026-05 | 4 | 25% | -$163.41 | -0.55 |
| 2026-06 | 2 | 100% | $244.92 | +1.68 |
| 2026-07 | 3 | 0% | -$237.50 | -1.07 |
| 2026-08 | 2 | 100% | $424.65 | +2.89 |
| 2026-09 | 4 | 25% | -$120.34 | -0.39 |
| 2026-10 | 1 | 0% | -$83.92 | -1.11 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 19949 | 70.3% |
| sem rompimento | 4556 | 16.1% |
| posição ou ordem já aberta neste mercado | 3546 | 12.5% |
| aquecimento (velas insuficientes) | 100 | 0.4% |
| volatilidade extrema | 42 | 0.1% |
| proteção de capital ativa (sem novas entradas) | 2 | 0.0% |
| sinal aceite | 171 | 0.6% |

Sinais → ordens → execuções → trades: 171 → 171 → 171 → 171. Sinais que o filtro de custo bloqueou: 1295 (666 compra, 629 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. EURUSD: p10 0.12% · mediana 0.24% · p90 0.46% · velas acima do mínimo 5% | GOLD: p10 0.34% · mediana 0.55% · p90 0.95% · velas acima do mínimo 40%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 171 | -25.2% | 0.67 | -0.16 | 32.5% |
| custo 2 bps | 625 | -66.3% | 0.60 | -0.21 | 73.5% |
| custo 15 bps | 42 | -12.6% | 0.47 | -0.31 | 13.9% |
| slippage 3× | 171 | -36.3% | 0.54 | -0.26 | 41.1% |
| sem slippage | 171 | -19.0% | 0.75 | -0.12 | 28.0% |
| sem filtro de custo | 704 | -91.1% | 0.36 | -0.49 | 91.1% |
| ordens limitadas | 168 | -19.0% | 0.75 | -0.12 | 27.7% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2023-05-28 · validação até 2025-02-07 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 84 / -0.37 | 31 / -0.06 [-0.32, +0.21] | ref. | 56 / +0.10 [-0.23, +0.51] · t 0.47 |
| S1 | stop móvel 4×ATR (em vez de 3): deixa a tendência respirar | 79 / -0.40 | 29 / +0.03 [-0.20, +0.25] | não | não calculado |
| S2 | EMA lenta 100 (em vez de 50): filtro de tendência mais lento | 78 / -0.35 | 29 / -0.15 [-0.37, +0.06] | não | não calculado |
| S3 | rompimento de 40 velas (em vez de 20): menos falsos rompimentos | 77 / -0.43 | 29 / -0.09 [-0.37, +0.19] | não | não calculado |
| S4 | stop inicial 3×ATR (em vez de 2) | 148 / -0.25 | 65 / -0.15 [-0.37, +0.09] | não | não calculado |

Teste em duas partes da app (60/40): taker: A 88 trades -0.38 R · B 83 trades +0.07 R (t 0.43) | maker: A 87 trades -0.33 R · B 81 trades +0.11 R (t 0.72) → não passa

## 7. Swing 1d (histórico longo)  [BIN-1d]

#### Swing 1d (histórico longo)
Período 2020-01-03 → 2026-10-20 (2482 dias) · mercados: GOLD 2245 velas, EURUSD 2483 velas · funding não incluído

| métrica | valor |
|---|---|
| trades (fechadas) | 88 (38G 50P) · abertas no fim: 2 |
| taxa de acerto | 43% |
| ganhos brutos / perdas brutas | $5263.96 / -$3830.94 |
| resultado líquido | $1433.02 (14.3%) |
| fator de lucro | 1.37 |
| ganho médio / perda média / relação | $138.53 / -$76.62 / 1.81 |
| expectativa por trade | $16.28 · +0.17 R (R ponderado pelo risco +0.17) |
| incerteza da expectativa em R | desvio 1.66 · IC95% por blocos [-0.13, +0.50] · P(média>0) 85% · t 0.94 (n=88) |
| antes de custos / custos | +0.29 R / 0.12 R por trade · taxas $712.30 · slippage $309.98 · funding (custo; negativo = recebido) $0.00 |
| risco por trade ($ = 1 R) | mín $88.33 · mediana $94.66 · máx $114.43 (varia com a conta) · Σ R +14.60 · Σ $ $1433.02 · Σ $ ÷ risco médio +14.83 R |
| queda máxima | $1339.76 (13.2%) · maior sequência de perdas 5 |
| comprar e manter | GOLD 111.8% · EURUSD 0.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| EURUSD | 33 | 42% | -$1.19 | +0.01 |
| GOLD | 55 | 44% | $1434.21 | +0.26 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| fim do teste | 2 | 100% | $157.40 | +0.70 |
| stop-loss | 80 | 39% | $374.00 | +0.04 |
| time-stop | 6 | 83% | $901.62 | +1.63 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 88 | 43% | $1433.02 | +0.17 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 29 | 59% | $473.10 | +0.17 |
| ATR baixo (1/3 inferior) | 30 | 43% | $810.53 | +0.28 |
| ATR médio | 29 | 28% | $149.38 | +0.05 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2020-03 | 1 | 0% | -$92.51 | -0.93 |
| 2020-05 | 1 | 0% | -$53.38 | -0.54 |
| 2020-07 | 1 | 100% | $295.24 | +3.00 |
| 2020-10 | 1 | 0% | -$111.26 | -1.10 |
| 2020-11 | 1 | 0% | -$106.56 | -1.06 |
| 2020-12 | 1 | 0% | -$52.97 | -0.53 |
| 2021-01 | 2 | 100% | $241.62 | +1.22 |
| 2021-02 | 2 | 0% | -$216.36 | -1.07 |
| 2021-03 | 1 | 0% | -$107.99 | -1.08 |
| 2021-04 | 2 | 50% | -$87.80 | -0.44 |
| 2021-05 | 2 | 0% | -$89.98 | -0.46 |
| 2021-08 | 2 | 50% | -$105.58 | -0.55 |
| 2021-09 | 1 | 0% | -$101.85 | -1.07 |
| 2021-10 | 1 | 0% | -$87.11 | -0.93 |
| 2021-11 | 1 | 0% | -$21.83 | -0.23 |
| 2021-12 | 1 | 100% | $134.05 | +1.43 |
| 2022-01 | 1 | 0% | -$101.19 | -1.07 |
| 2022-02 | 2 | 50% | -$28.06 | -0.15 |
| 2022-03 | 1 | 0% | -$93.72 | -1.01 |
| 2022-04 | 1 | 0% | -$98.52 | -1.07 |
| 2022-05 | 3 | 33% | -$51.22 | -0.18 |
| 2022-06 | 2 | 0% | -$160.66 | -0.88 |
| 2022-07 | 2 | 100% | $101.18 | +0.56 |
| 2022-09 | 3 | 67% | $6.42 | +0.02 |
| 2022-10 | 2 | 0% | -$140.67 | -0.78 |
| 2022-11 | 1 | 0% | -$80.95 | -0.91 |
| 2023-01 | 2 | 100% | $404.28 | +2.28 |
| 2023-02 | 1 | 0% | -$52.79 | -0.58 |
| 2023-05 | 1 | 0% | -$10.82 | -0.12 |
| 2023-06 | 3 | 0% | -$205.28 | -0.75 |
| 2023-08 | 2 | 50% | -$25.23 | -0.14 |
| 2023-10 | 1 | 100% | $44.87 | +0.50 |
| 2023-11 | 1 | 0% | -$88.14 | -0.99 |
| 2023-12 | 1 | 100% | $74.06 | +0.84 |
| 2024-01 | 1 | 0% | -$95.86 | -1.07 |
| 2024-04 | 3 | 100% | $533.99 | +1.99 |
| 2024-05 | 1 | 0% | -$98.43 | -1.05 |
| 2024-07 | 1 | 0% | -$5.03 | -0.05 |
| 2024-08 | 1 | 100% | $52.65 | +0.57 |
| 2024-10 | 1 | 100% | $152.96 | +1.65 |
| 2024-11 | 2 | 0% | -$80.69 | -0.43 |
| 2025-01 | 2 | 50% | $3.25 | +0.02 |
| 2025-02 | 2 | 50% | $132.88 | +0.72 |
| 2025-03 | 2 | 100% | $187.33 | +0.98 |
| 2025-04 | 2 | 50% | -$47.57 | -0.24 |
| 2025-05 | 1 | 0% | -$37.68 | -0.39 |
| 2025-06 | 1 | 100% | $26.16 | +0.27 |
| 2025-07 | 2 | 50% | $31.97 | +0.17 |
| 2025-10 | 3 | 67% | $989.59 | +3.39 |
| 2025-11 | 1 | 0% | -$111.71 | -1.05 |
| 2025-12 | 1 | 100% | $127.07 | +1.20 |
| 2026-01 | 1 | 100% | $673.44 | +6.30 |
| 2026-03 | 3 | 33% | -$53.90 | -0.16 |
| 2026-05 | 1 | 0% | -$114.58 | -1.01 |
| 2026-06 | 1 | 100% | $155.66 | +1.39 |
| 2026-07 | 1 | 0% | -$117.09 | -1.03 |
| 2026-08 | 1 | 100% | $41.91 | +0.37 |
| 2026-10 | 2 | 100% | $157.40 | +0.70 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| sem rompimento | 2180 | 46.1% |
| posição ou ordem já aberta neste mercado | 1445 | 30.6% |
| filtro de custo (custo por trade acima do máximo em R) | 827 | 17.5% |
| aquecimento (velas insuficientes) | 100 | 2.1% |
| volatilidade extrema | 88 | 1.9% |
| sinal aceite | 88 | 1.9% |

Sinais → ordens → execuções → trades: 88 → 88 → 88 → 88. Sinais que o filtro de custo bloqueou: 63 (26 compra, 37 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. EURUSD: p10 0.40% · mediana 0.63% · p90 1.04% · velas acima do mínimo 53% | GOLD: p10 0.95% · mediana 1.40% · p90 2.38% · velas acima do mínimo 100%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 88 | 14.3% | 1.37 | +0.17 | 13.2% |
| custo 2 bps | 114 | 14.7% | 1.30 | +0.13 | 14.6% |
| custo 15 bps | 59 | 5.2% | 1.18 | +0.10 | 9.6% |
| slippage 3× | 89 | 5.7% | 1.14 | +0.08 | 15.9% |
| sem slippage | 88 | 17.7% | 1.47 | +0.20 | 12.3% |
| sem filtro de custo | 116 | 2.2% | 1.04 | +0.03 | 19.6% |
| ordens limitadas | 88 | 16.1% | 1.43 | +0.18 | 12.5% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2023-05-28 · validação até 2025-02-07 · teste final depois. Variantes testadas: 5; limiar |t| individual 1,96, corrigido (Bonferroni) 2.58.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 43 / -0.21 | 21 / +0.26 [-0.13, +0.69] | ref. | 24 / +0.75 [+0.05, +1.52] · t 1.47 |
| S1 | stop móvel 4×ATR (em vez de 3): deixa a tendência respirar | 39 / -0.22 | 20 / +0.11 [-0.27, +0.54] | não | não calculado |
| S2 | EMA lenta 100 (em vez de 50): filtro de tendência mais lento | 41 / -0.30 | 19 / +0.25 [-0.16, +0.72] | não | não calculado |
| S3 | rompimento de 40 velas (em vez de 20): menos falsos rompimentos | 35 / -0.18 | 17 / +0.31 [-0.32, +0.99] | sim | 20 / +0.83 [-0.02, +1.82] · t 1.53 |
| S4 | stop inicial 3×ATR (em vez de 2) | 49 / -0.19 | 29 / -0.06 [-0.25, +0.17] | não | não calculado |

Teste em duas partes da app (60/40): taker: A 52 trades -0.23 R · B 36 trades +0.74 R (t 2.03) | maker: A 52 trades -0.22 R · B 36 trades +0.76 R (t 2.06) → não passa

## 8. Rompimento 4h (histórico longo)  [BIN-4h]

#### Rompimento 4h (histórico longo)
Período 2020-01-03 → 2026-10-21 (2483 dias) · mercados: GOLD 13469 velas, EURUSD 14897 velas · funding não incluído

| métrica | valor |
|---|---|
| trades (fechadas) | 212 (83G 129P) · abertas no fim: 0 |
| taxa de acerto | 39% |
| ganhos brutos / perdas brutas | $9122.68 / -$11219.86 |
| resultado líquido | -$2097.18 (-21.0%) |
| fator de lucro | 0.81 |
| ganho médio / perda média / relação | $109.91 / -$86.98 / 1.26 |
| expectativa por trade | -$9.89 · -0.10 R (R ponderado pelo risco -0.12) |
| incerteza da expectativa em R | desvio 1.23 · IC95% por blocos [-0.25, +0.05] · P(média>0) 10% · t -1.23 (n=212) |
| antes de custos / custos | +0.04 R / 0.14 R por trade · taxas $1726.61 · slippage $664.90 · funding (custo; negativo = recebido) $0.00 |
| risco por trade ($ = 1 R) | mín $72.56 · mediana $78.99 · máx $100.00 (varia com a conta) · Σ R -21.90 · Σ $ -$2097.18 · Σ $ ÷ risco médio -26.09 R |
| queda máxima | $2820.00 (28.1%) · maior sequência de perdas 9 |
| comprar e manter | GOLD 112.3% · EURUSD 0.8% |

| mercado | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| EURUSD | 18 | 28% | -$718.66 | -0.43 |
| GOLD | 194 | 40% | -$1378.52 | -0.07 |

| saída | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| kill-switch | 1 | 0% | -$35.37 | -0.44 |
| stop-loss | 125 | 0% | -$11073.92 | -1.09 |
| take-profit | 77 | 100% | $8955.76 | +1.48 |
| time-stop | 9 | 67% | $56.35 | +0.09 |

| sessão (abertura) | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| Ásia 00-08 UTC | 53 | 30% | -$1379.51 | -0.31 |
| EUA 13-21 UTC | 104 | 45% | $174.27 | +0.04 |
| Europa 08-13 UTC | 55 | 36% | -$891.95 | -0.18 |

| regime de volatilidade | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| ATR alto (1/3 superior) | 70 | 33% | -$1664.86 | -0.28 |
| ATR baixo (1/3 inferior) | 71 | 38% | -$756.71 | -0.12 |
| ATR médio | 71 | 46% | $324.39 | +0.08 |

| mês | trades | acerto | P/L | R médio |
|---|---|---|---|---|
| 2020-03 | 3 | 0% | -$316.02 | -1.06 |
| 2020-04 | 1 | 0% | -$106.34 | -1.10 |
| 2020-05 | 2 | 0% | -$209.14 | -1.10 |
| 2020-06 | 1 | 100% | $138.46 | +1.48 |
| 2020-08 | 1 | 0% | -$105.90 | -1.11 |
| 2020-09 | 1 | 0% | -$102.37 | -1.09 |
| 2020-10 | 3 | 33% | -$174.69 | -0.63 |
| 2020-11 | 4 | 0% | -$392.98 | -1.09 |
| 2020-12 | 3 | 0% | -$283.37 | -1.09 |
| 2021-01 | 5 | 80% | $325.22 | +0.77 |
| 2021-02 | 3 | 33% | -$64.14 | -0.24 |
| 2021-03 | 4 | 25% | -$133.13 | -0.38 |
| 2021-04 | 5 | 20% | -$239.66 | -0.56 |
| 2021-05 | 5 | 40% | $55.51 | +0.14 |
| 2021-06 | 4 | 25% | -$154.58 | -0.46 |
| 2021-07 | 1 | 0% | -$23.84 | -0.29 |
| 2021-08 | 2 | 50% | $31.14 | +0.20 |
| 2021-09 | 2 | 50% | $29.70 | +0.19 |
| 2021-10 | 1 | 0% | -$92.04 | -1.11 |
| 2021-11 | 2 | 50% | $28.67 | +0.18 |
| 2021-12 | 2 | 50% | $28.34 | +0.18 |
| 2022-01 | 3 | 0% | -$213.16 | -0.87 |
| 2022-02 | 6 | 50% | $90.46 | +0.20 |
| 2022-03 | 5 | 40% | -$30.41 | -0.07 |
| 2022-04 | 1 | 0% | -$90.08 | -1.11 |
| 2022-05 | 4 | 0% | -$334.99 | -1.06 |
| 2022-06 | 1 | 0% | -$82.18 | -1.07 |
| 2022-07 | 5 | 60% | $166.06 | +0.44 |
| 2022-09 | 2 | 0% | -$169.01 | -1.10 |
| 2022-10 | 1 | 0% | -$83.77 | -1.11 |
| 2022-11 | 5 | 40% | -$71.58 | -0.19 |
| 2022-12 | 2 | 0% | -$164.14 | -1.11 |
| 2023-02 | 2 | 50% | $27.86 | +0.20 |
| 2023-03 | 2 | 100% | $217.76 | +1.48 |
| 2023-04 | 1 | 0% | -$83.62 | -1.11 |
| 2023-05 | 1 | 100% | $109.43 | +1.48 |
| 2023-06 | 1 | 0% | -$83.38 | -1.11 |
| 2023-10 | 1 | 100% | $109.98 | +1.48 |
| 2023-11 | 2 | 50% | $26.31 | +0.18 |
| 2024-02 | 2 | 0% | -$167.95 | -1.11 |
| 2024-03 | 3 | 67% | $138.46 | +0.63 |
| 2024-04 | 8 | 50% | $112.30 | +0.19 |
| 2024-05 | 2 | 100% | $228.30 | +1.48 |
| 2024-06 | 1 | 0% | -$86.94 | -1.10 |
| 2024-07 | 3 | 33% | -$57.21 | -0.24 |
| 2024-08 | 2 | 50% | $30.74 | +0.21 |
| 2024-09 | 2 | 100% | $119.25 | +0.77 |
| 2024-11 | 6 | 50% | -$15.32 | -0.03 |
| 2024-12 | 1 | 0% | -$87.55 | -1.11 |
| 2025-01 | 1 | 100% | $115.07 | +1.48 |
| 2025-02 | 3 | 67% | $147.73 | +0.63 |
| 2025-03 | 3 | 33% | -$60.11 | -0.24 |
| 2025-04 | 8 | 38% | -$90.67 | -0.13 |
| 2025-05 | 4 | 25% | -$144.15 | -0.45 |
| 2025-06 | 1 | 0% | -$82.60 | -1.06 |
| 2025-07 | 1 | 100% | $22.37 | +0.29 |
| 2025-09 | 1 | 100% | $113.68 | +1.48 |
| 2025-10 | 7 | 43% | $4.05 | +0.01 |
| 2025-11 | 4 | 25% | -$143.86 | -0.46 |
| 2025-12 | 1 | 0% | -$85.64 | -1.12 |
| 2026-01 | 6 | 50% | $87.81 | +0.20 |
| 2026-02 | 8 | 38% | -$78.58 | -0.12 |
| 2026-03 | 7 | 71% | $407.81 | +0.76 |
| 2026-04 | 4 | 25% | -$141.76 | -0.44 |
| 2026-05 | 4 | 25% | -$143.49 | -0.45 |
| 2026-06 | 4 | 75% | $262.81 | +0.85 |
| 2026-07 | 4 | 0% | -$339.70 | -1.08 |
| 2026-08 | 5 | 80% | $375.35 | +0.97 |
| 2026-09 | 5 | 40% | -$29.10 | -0.06 |
| 2026-10 | 1 | 0% | -$88.62 | -1.11 |

Recálculo cruzado a partir das trades: coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem).

Diagnóstico por vela (porque entrou ou não):

| razão | velas | % |
|---|---|---|
| filtro de custo (custo por trade acima do máximo em R) | 19748 | 69.6% |
| posição ou ordem já aberta neste mercado | 4210 | 14.8% |
| sem rompimento | 4055 | 14.3% |
| aquecimento (velas insuficientes) | 100 | 0.4% |
| volatilidade extrema | 39 | 0.1% |
| proteção de capital ativa (sem novas entradas) | 2 | 0.0% |
| sinal aceite | 212 | 0.7% |

Sinais → ordens → execuções → trades: 212 → 212 → 212 → 212. Sinais que o filtro de custo bloqueou: 1287 (660 compra, 627 venda).
ATR em % do preço — mínimo exigido pelo filtro: 0.60%. EURUSD: p10 0.12% · mediana 0.24% · p90 0.45% · velas acima do mínimo 4% | GOLD: p10 0.34% · mediana 0.54% · p90 0.94% · velas acima do mínimo 38%

Sensibilidade a custos e execução:

| variante | trades | resultado | fator lucro | R médio | queda |
|---|---|---|---|---|---|
| regras atuais | 212 | -21.0% | 0.81 | -0.10 | 28.1% |
| custo 2 bps | 806 | -70.6% | 0.71 | -0.19 | 73.0% |
| custo 15 bps | 47 | -13.8% | 0.54 | -0.31 | 14.9% |
| slippage 3× | 211 | -31.9% | 0.71 | -0.17 | 36.0% |
| sem slippage | 209 | -11.8% | 0.90 | -0.05 | 22.0% |
| sem filtro de custo | 880 | -93.1% | 0.50 | -0.44 | 93.3% |
| ordens limitadas | 207 | -13.6% | 0.88 | -0.06 | 23.9% |

Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):

Partições cronológicas: desenvolvimento até 2023-05-28 · validação até 2025-02-07 · teste final depois. Variantes testadas: 1; limiar |t| individual 1,96, corrigido (Bonferroni) 1.96.

| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |
|---|---|---|---|---|---|
| base | referência (parâmetros originais) | 96 / -0.29 | 37 / +0.15 [-0.03, +0.36] | ref. | 79 / +0.00 [-0.21, +0.24] · t 0.02 |

Teste em duas partes da app (60/40): taker: A 100 trades -0.27 R · B 112 trades +0.05 R (t 0.38) | maker: A 98 trades -0.22 R · B 109 trades +0.08 R (t 0.64) → não passa
