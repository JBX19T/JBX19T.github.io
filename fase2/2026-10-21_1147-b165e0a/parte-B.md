# Parte B — Diagnóstico do rompimento atual

Regra analisada: rompimento do máximo/mínimo de 20 velas a favor de EMA 20/50, stop 2×ATR, alvo 3×ATR (saída A), em ouro (PAXG) e EUR/USD (EURUSDT) da Binance, **só desenvolvimento e validação**. Cada experiência muda **um** fator; a comparação é emparelhada com a referência (mesmos dados) e corrigida por Holm.

## Velas de 4h

### B1. A entrada tem vantagem, antes de saídas e custos? (4h)

- GOLD: 460 sinais brutos, 128 sem sobreposição (1 por 48 velas).
- EURUSD: 750 sinais brutos, 164 sem sobreposição (1 por 48 velas).

| mercado | horizonte (velas) | sinais | compra/venda | retorno futuro médio (R) | t | aleatório: média ± desvio (R) | p (vs aleatório) | E-ratio | E-ratio aleatório | p do E-ratio | custo ida-e-volta (R) | p Holm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GOLD | 1 | 128 | 73/55 | +0.05 | 1.46 | +0.00 ± 0.03 | 0.031 | 1.28 | 1.01 | 0.043 | 0.23 | 0.429 |
| GOLD | 2 | 128 | 73/55 | +0.01 | 0.27 | +0.00 ± 0.04 | 0.383 | 1.18 | 1.01 | 0.123 | 0.23 | 1.000 |
| GOLD | 4 | 128 | 73/55 | -0.01 | -0.21 | +0.00 ± 0.06 | 0.617 | 1.07 | 1.02 | 0.348 | 0.23 | 1.000 |
| GOLD | 6 | 128 | 73/55 | +0.04 | 0.59 | +0.01 ± 0.07 | 0.308 | 1.09 | 1.02 | 0.307 | 0.23 | 1.000 |
| GOLD | 12 | 128 | 73/55 | -0.00 | -0.02 | +0.01 ± 0.11 | 0.561 | 1.04 | 1.03 | 0.430 | 0.23 | 1.000 |
| GOLD | 24 | 128 | 73/55 | +0.19 | 1.61 | +0.03 ± 0.15 | 0.144 | 1.25 | 1.04 | 0.101 | 0.23 | 1.000 |
| GOLD | 48 | 128 | 73/55 | +0.29 | 1.45 | +0.04 ± 0.22 | 0.130 | 1.53 | 1.05 | 0.007 | 0.23 | 1.000 |
| EURUSD | 1 | 164 | 84/80 | -0.05 | -0.83 | +0.00 ± 0.04 | 0.903 | 1.01 | 1.08 | 0.479 | 0.58 | 1.000 |
| EURUSD | 2 | 164 | 84/80 | +0.00 | 0.07 | +0.00 ± 0.05 | 0.466 | 1.10 | 1.08 | 0.296 | 0.58 | 1.000 |
| EURUSD | 4 | 164 | 84/80 | -0.10 | -1.18 | -0.00 ± 0.07 | 0.929 | 1.06 | 1.12 | 0.373 | 0.58 | 1.000 |
| EURUSD | 6 | 164 | 84/80 | -0.08 | -0.74 | +0.00 ± 0.08 | 0.821 | 1.06 | 1.15 | 0.394 | 0.58 | 1.000 |
| EURUSD | 12 | 164 | 84/80 | -0.21 | -1.61 | +0.00 ± 0.12 | 0.965 | 0.92 | 1.10 | 0.713 | 0.58 | 1.000 |
| EURUSD | 24 | 164 | 84/80 | -0.05 | -0.27 | -0.00 ± 0.16 | 0.613 | 1.01 | 1.05 | 0.470 | 0.58 | 1.000 |
| EURUSD | 48 | 164 | 84/80 | +0.10 | 0.43 | +0.00 ± 0.23 | 0.327 | 1.07 | 1.05 | 0.372 | 0.58 | 1.000 |

«R» = retorno do ativo na direção do sinal, medido da abertura seguinte, em unidades de 2×ATR. «Aleatório» = o mesmo nº de entradas (mesma proporção de compras) em instantes ao acaso, 3 000 sorteios. O custo de ida e volta é o do bot (12 bps por lado incluindo slippage).

### B2. Experiências controladas, um fator de cada vez (4h)

| experiência | trades | R médio | R bruto | resultado | queda | Δ retorno diário vs referência | t | p (variante > ref.) | p Holm | Δ dev/val | veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **REFERÊNCIA (regra atual)** | 145 | -0.16 | -0.00 | -21.0% | 23.9% | — | — | — | — | — | — |
| confirmação: fecho +0,25 ATR além do nível | 101 | -0.20 | -0.04 | -18.5% | 22.2% | +0.2 bp | 0.56 | 0.306 | 1.000 | +/+ | sem diferença detetável |
| confirmação: +0,5 ATR | 64 | -0.13 | +0.03 | -8.4% | 14.1% | +0.8 bp | 2.07 | 0.017 | 0.472 | +/+ | sem diferença detetável |
| confirmação: +1 ATR | 30 | -0.14 | +0.03 | -4.1% | 6.8% | +1.0 bp | 2.45 | 0.006 | 0.182 | +/− | sem diferença detetável |
| rejeitar rompimento esticado (>1 ATR do nível) | 123 | -0.16 | -0.01 | -18.7% | 20.7% | +0.2 bp | 0.67 | 0.229 | 1.000 | +/− | sem diferença detetável |
| rejeitar esticado (>2 ATR) | 141 | -0.17 | -0.02 | -22.1% | 23.8% | -0.1 bp | -0.58 | 0.701 | 1.000 | +/− | sem diferença detetável |
| sem filtro de tendência | 206 | -0.22 | -0.06 | -36.3% | 37.6% | -1.1 bp | -3.84 | 1.000 | 1.000 | −/− | pior |
| tendência EMA 10/30 | 187 | -0.21 | -0.05 | -32.4% | 34.8% | -0.8 bp | -3.41 | 1.000 | 1.000 | −/− | pior |
| tendência EMA 50/200 | 114 | -0.12 | +0.04 | -12.9% | 14.6% | +0.5 bp | 1.66 | 0.053 | 1.000 | +/− | sem diferença detetável |
| ADX ≥ 20 | 118 | -0.22 | -0.06 | -22.9% | 25.9% | -0.1 bp | -0.60 | 0.710 | 1.000 | −/+ | sem diferença detetável |
| ADX ≥ 25 | 86 | -0.25 | -0.10 | -19.7% | 22.2% | +0.1 bp | 0.23 | 0.398 | 1.000 | +/− | sem diferença detetável |
| ADX ≥ 30 | 57 | -0.23 | -0.08 | -12.3% | 14.3% | +0.5 bp | 1.43 | 0.078 | 1.000 | +/− | sem diferença detetável |
| volatilidade: ATR% acima da mediana | 120 | -0.15 | -0.00 | -17.0% | 19.3% | +0.3 bp | 0.99 | 0.160 | 1.000 | +/− | sem diferença detetável |
| volatilidade: ATR% baixo (compressão) | 11 | -0.12 | +0.05 | -1.4% | 5.1% | +1.2 bp | 2.79 | 0.003 | 0.087 | +/+ | sem diferença detetável |
| vela de expansão (≥1,5 ATR) | 99 | -0.13 | +0.02 | -12.6% | 14.9% | +0.5 bp | 1.93 | 0.031 | 0.775 | +/− | sem diferença detetável |
| volume ≥ 1,5× média de 20 | 105 | -0.20 | -0.05 | -19.5% | 20.2% | +0.1 bp | 0.29 | 0.388 | 1.000 | +/− | sem diferença detetável |
| sessão 07-15 UTC | 93 | -0.13 | +0.03 | -11.3% | 15.4% | +0.6 bp | 1.87 | 0.032 | 0.775 | +/+ | sem diferença detetável |
| sessão 13-21 UTC | 62 | -0.13 | +0.03 | -7.8% | 8.5% | +0.8 bp | 1.93 | 0.027 | 0.715 | +/− | sem diferença detetável |
| sem 00-07 UTC | 129 | -0.14 | +0.02 | -16.6% | 21.0% | +0.3 bp | 1.17 | 0.121 | 1.000 | +/+ | sem diferença detetável |
| momentum: ROC(10) concorda | 145 | -0.16 | -0.00 | -21.0% | 23.9% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| momentum: RSI(14) >55/<45 | 145 | -0.16 | -0.00 | -21.0% | 23.9% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| reteste do nível (≤6 velas) | 169 | -0.23 | -0.07 | -32.9% | 33.0% | -0.9 bp | -1.82 | 0.972 | 1.000 | −/− | pior |
| rompimento de 10 velas | 180 | -0.20 | -0.04 | -30.8% | 33.1% | -0.7 bp | -2.14 | 0.984 | 1.000 | −/− | pior |
| rompimento de 40 velas | 130 | -0.22 | -0.07 | -25.2% | 27.1% | -0.3 bp | -1.22 | 0.895 | 1.000 | −/− | sem diferença detetável |
| rompimento de 55 velas | 121 | -0.22 | -0.07 | -23.6% | 25.5% | -0.2 bp | -0.67 | 0.752 | 1.000 | −/− | sem diferença detetável |
| saída B: stop 2, alvo 1,5 | 175 | -0.13 | +0.01 | -21.2% | 23.1% | -0.0 bp | -0.06 | 0.526 | 1.000 | +/− | sem diferença detetável |
| saída C: stop 3, stop móvel 3 | 204 | -0.24 | -0.09 | -38.7% | 42.1% | -1.3 bp | -2.28 | 0.986 | 1.000 | −/− | pior |
| saída E: stop 3, canal oposto | 164 | -0.23 | -0.08 | -31.8% | 35.3% | -0.7 bp | -1.08 | 0.870 | 1.000 | −/− | sem diferença detetável |
| saída F: break-even a 1,5 ATR | 139 | -0.26 | -0.10 | -30.3% | 32.3% | -0.7 bp | -1.83 | 0.969 | 1.000 | −/− | pior |
| execução: ordens limitadas (maker) | 143 | -0.14 | -0.05 | -18.7% | 22.1% | +0.2 bp | 0.71 | 0.233 | 1.000 | +/+ | sem diferença detetável |

Veredicto «melhora» exige Holm < 0,05 **e** diferença positiva no desenvolvimento e na validação. Nº de experiências corrigidas: 29. Δ em pontos-base de retorno diário médio da conta.

### B3. Onde perde a referência? (4h)

| dimensão | grupo | trades | R líquido | R bruto | acerto |
|---|---|---|---|---|---|
| direção | compra | 85 | -0.12 | +0.03 | 41% |
| direção | venda | 60 | -0.21 | -0.06 | 35% |
| mercado | EURUSD | 19 | -0.28 | -0.14 | 32% |
| mercado | GOLD | 126 | -0.14 | +0.02 | 40% |
| saída | kill-switch | 1 | -0.45 | -0.27 | 0% |
| saída | stop-loss | 48 | -1.09 | -0.92 | 0% |
| saída | take-profit | 15 | +1.48 | +1.58 | 100% |
| saída | time-stop | 81 | +0.09 | +0.25 | 51% |
| volatilidade (ATR%) | 1/3 alto | 48 | -0.28 | -0.17 | 31% |
| volatilidade (ATR%) | 1/3 baixo | 49 | -0.27 | -0.08 | 35% |
| volatilidade (ATR%) | 1/3médio | 48 | +0.07 | +0.24 | 50% |
| hora de abertura (UTC) | 00-08 | 24 | -0.44 | -0.28 | 25% |
| hora de abertura (UTC) | 08-16 | 39 | -0.29 | -0.14 | 33% |
| hora de abertura (UTC) | 16-24 | 82 | -0.01 | +0.14 | 45% |
| duração | 3-8 velas | 32 | -0.37 | -0.22 | 28% |
| duração | >8 velas | 94 | +0.04 | +0.19 | 48% |
| duração | ≤2 velas | 19 | -0.79 | -0.62 | 11% |

## Velas de 1h

### B1. A entrada tem vantagem, antes de saídas e custos? (1h)

- GOLD: 1146 sinais brutos, 290 sem sobreposição (1 por 48 velas).
- EURUSD: 1796 sinais brutos, 340 sem sobreposição (1 por 48 velas).

| mercado | horizonte (velas) | sinais | compra/venda | retorno futuro médio (R) | t | aleatório: média ± desvio (R) | p (vs aleatório) | E-ratio | E-ratio aleatório | p do E-ratio | custo ida-e-volta (R) | p Holm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GOLD | 1 | 290 | 165/125 | -0.03 | -1.17 | +0.00 ± 0.02 | 0.942 | 0.89 | 1.01 | 0.873 | 0.55 | 1.000 |
| GOLD | 2 | 290 | 165/125 | -0.03 | -0.89 | +0.00 ± 0.03 | 0.871 | 0.89 | 1.01 | 0.869 | 0.55 | 1.000 |
| GOLD | 4 | 290 | 165/125 | -0.03 | -0.55 | +0.01 ± 0.04 | 0.768 | 0.91 | 1.02 | 0.849 | 0.55 | 1.000 |
| GOLD | 6 | 290 | 165/125 | -0.00 | -0.08 | +0.01 ± 0.05 | 0.576 | 0.94 | 1.01 | 0.736 | 0.55 | 1.000 |
| GOLD | 12 | 290 | 165/125 | +0.02 | 0.24 | +0.01 ± 0.09 | 0.445 | 0.95 | 1.01 | 0.702 | 0.55 | 1.000 |
| GOLD | 24 | 290 | 165/125 | +0.14 | 1.12 | +0.01 ± 0.15 | 0.196 | 1.04 | 1.01 | 0.386 | 0.55 | 1.000 |
| GOLD | 48 | 290 | 165/125 | +0.21 | 1.07 | +0.03 ± 0.24 | 0.223 | 1.14 | 1.02 | 0.173 | 0.55 | 1.000 |
| EURUSD | 1 | 340 | 183/157 | -0.01 | -0.40 | -0.00 ± 0.03 | 0.678 | 0.69 | 1.02 | 0.991 | 2.03 | 1.000 |
| EURUSD | 2 | 340 | 183/157 | +0.04 | 1.04 | -0.00 ± 0.04 | 0.137 | 0.79 | 1.02 | 0.966 | 2.03 | 1.000 |
| EURUSD | 4 | 340 | 183/157 | +0.04 | 0.71 | +0.00 ± 0.06 | 0.244 | 0.86 | 1.02 | 0.875 | 2.03 | 1.000 |
| EURUSD | 6 | 340 | 183/157 | +0.06 | 0.83 | +0.00 ± 0.08 | 0.237 | 0.93 | 1.03 | 0.740 | 2.03 | 1.000 |
| EURUSD | 12 | 340 | 183/157 | +0.08 | 0.82 | +0.01 ± 0.11 | 0.237 | 0.98 | 1.02 | 0.590 | 2.03 | 1.000 |
| EURUSD | 24 | 340 | 183/157 | +0.24 | 1.25 | +0.02 ± 0.17 | 0.104 | 1.08 | 1.03 | 0.340 | 2.03 | 1.000 |
| EURUSD | 48 | 340 | 183/157 | +0.08 | 0.28 | +0.03 ± 0.26 | 0.423 | 1.36 | 1.04 | 0.016 | 2.03 | 1.000 |

«R» = retorno do ativo na direção do sinal, medido da abertura seguinte, em unidades de 2×ATR. «Aleatório» = o mesmo nº de entradas (mesma proporção de compras) em instantes ao acaso, 3 000 sorteios. O custo de ida e volta é o do bot (12 bps por lado incluindo slippage).

### B2. Experiências controladas, um fator de cada vez (1h)

| experiência | trades | R médio | R bruto | resultado | queda | Δ retorno diário vs referência | t | p (variante > ref.) | p Holm | Δ dev/val | veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **REFERÊNCIA (regra atual)** | 19 | -0.62 | -0.45 | -11.2% | 12.5% | — | — | — | — | — | — |
| confirmação: fecho +0,25 ATR além do nível | 15 | -0.51 | -0.36 | -7.5% | 7.9% | +0.4 bp | 2.11 | 0.006 | 0.150 | +/+ | sem diferença detetável |
| confirmação: +0,5 ATR | 13 | -0.47 | -0.31 | -6.0% | 7.4% | +0.6 bp | 2.41 | 0.002 | 0.056 | +/+ | sem diferença detetável |
| confirmação: +1 ATR | 4 | -1.10 | -0.92 | -4.3% | 4.3% | +0.8 bp | 2.27 | 0.003 | 0.091 | +/+ | sem diferença detetável |
| rejeitar rompimento esticado (>1 ATR do nível) | 15 | -0.49 | -0.33 | -7.2% | 8.5% | +0.5 bp | 2.20 | 0.011 | 0.253 | +/+ | sem diferença detetável |
| rejeitar esticado (>2 ATR) | 17 | -0.56 | -0.40 | -9.2% | 10.5% | +0.2 bp | 1.47 | 0.083 | 1.000 | +/+ | sem diferença detetável |
| sem filtro de tendência | 31 | -0.35 | -0.20 | -10.4% | 11.5% | +0.1 bp | 0.27 | 0.398 | 1.000 | −/+ | sem diferença detetável |
| tendência EMA 10/30 | 29 | -0.41 | -0.25 | -11.3% | 12.3% | -0.0 bp | -0.01 | 0.519 | 1.000 | +/− | sem diferença detetável |
| tendência EMA 50/200 | 11 | -0.91 | -0.73 | -9.5% | 10.5% | +0.2 bp | 0.79 | 0.246 | 1.000 | −/+ | sem diferença detetável |
| ADX ≥ 20 | 17 | -0.62 | -0.46 | -10.1% | 10.4% | +0.1 bp | 1.32 | 0.117 | 1.000 | +/+ | sem diferença detetável |
| ADX ≥ 25 | 16 | -0.59 | -0.43 | -9.1% | 9.4% | +0.3 bp | 1.39 | 0.035 | 0.700 | +/+ | sem diferença detetável |
| ADX ≥ 30 | 14 | -0.51 | -0.36 | -7.0% | 7.4% | +0.5 bp | 2.14 | 0.006 | 0.150 | +/+ | sem diferença detetável |
| volatilidade: ATR% acima da mediana | 19 | -0.62 | -0.45 | -11.2% | 12.5% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| volatilidade: ATR% baixo (compressão) | 0 | — | — | 0.0% | 0.0% | +1.3 bp | 2.83 | <0.001 | 0.014 | +/+ | **melhora** |
| vela de expansão (≥1,5 ATR) | 14 | -0.62 | -0.46 | -8.3% | 9.6% | +0.3 bp | 1.65 | 0.031 | 0.660 | +/+ | sem diferença detetável |
| volume ≥ 1,5× média de 20 | 17 | -0.76 | -0.59 | -12.2% | 13.4% | -0.1 bp | -0.57 | 0.723 | 1.000 | −/− | sem diferença detetável |
| sessão 07-15 UTC | 5 | -0.42 | -0.27 | -2.1% | 3.9% | +1.0 bp | 2.10 | 0.003 | 0.081 | +/+ | sem diferença detetável |
| sessão 13-21 UTC | 10 | -0.65 | -0.47 | -6.3% | 8.6% | +0.6 bp | 1.61 | 0.035 | 0.700 | +/+ | sem diferença detetável |
| sem 00-07 UTC | 16 | -0.76 | -0.59 | -11.6% | 13.7% | -0.0 bp | -0.22 | 0.601 | 1.000 | −/− | sem diferença detetável |
| momentum: ROC(10) concorda | 19 | -0.62 | -0.45 | -11.2% | 12.5% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| momentum: RSI(14) >55/<45 | 19 | -0.62 | -0.45 | -11.2% | 12.5% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| reteste do nível (≤6 velas) | 30 | -0.33 | -0.18 | -9.5% | 10.2% | +0.2 bp | 0.39 | 0.367 | 1.000 | −/+ | sem diferença detetável |
| rompimento de 10 velas | 23 | -0.58 | -0.41 | -12.6% | 14.0% | -0.2 bp | -1.31 | 0.913 | 1.000 | +/− | sem diferença detetável |
| rompimento de 40 velas | 19 | -0.62 | -0.45 | -11.2% | 12.5% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| rompimento de 55 velas | 19 | -0.62 | -0.45 | -11.2% | 12.5% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| saída B: stop 2, alvo 1,5 | 21 | -0.40 | -0.24 | -8.1% | 9.4% | +0.4 bp | 1.36 | 0.069 | 1.000 | +/+ | sem diferença detetável |
| saída C: stop 3, stop móvel 3 | 91 | -0.27 | -0.09 | -22.2% | 22.4% | -1.4 bp | -1.40 | 0.914 | 1.000 | −/− | sem diferença detetável |
| saída E: stop 3, canal oposto | 79 | -0.40 | -0.23 | -27.4% | 27.8% | -2.1 bp | -2.16 | 0.990 | 1.000 | −/− | pior |
| saída F: break-even a 1,5 ATR | 19 | -0.48 | -0.31 | -8.8% | 10.1% | +0.3 bp | 0.90 | 0.187 | 1.000 | −/+ | sem diferença detetável |
| execução: ordens limitadas (maker) | 19 | -0.59 | -0.49 | -10.7% | 12.1% | +0.1 bp | 1.76 | 0.030 | 0.660 | +/+ | sem diferença detetável |

Veredicto «melhora» exige Holm < 0,05 **e** diferença positiva no desenvolvimento e na validação. Nº de experiências corrigidas: 29. Δ em pontos-base de retorno diário médio da conta.

### B3. Onde perde a referência? (1h)

| dimensão | grupo | trades | R líquido | R bruto | acerto |
|---|---|---|---|---|---|
| direção | compra | 8 | -0.59 | -0.42 | 25% |
| direção | venda | 11 | -0.64 | -0.48 | 9% |
| mercado | EURUSD | 2 | -1.10 | -0.92 | 0% |
| mercado | GOLD | 17 | -0.56 | -0.40 | 18% |
| saída | stop-loss | 12 | -1.09 | -0.92 | 0% |
| saída | take-profit | 2 | +1.48 | +1.59 | 100% |
| saída | time-stop | 5 | -0.33 | -0.15 | 20% |
| volatilidade (ATR%) | 1/3 alto | 6 | -0.94 | -0.81 | 0% |
| volatilidade (ATR%) | 1/3 baixo | 7 | -0.46 | -0.27 | 14% |
| volatilidade (ATR%) | 1/3médio | 6 | -0.48 | -0.31 | 33% |
| hora de abertura (UTC) | 00-08 | 4 | -0.17 | -0.02 | 50% |
| hora de abertura (UTC) | 08-16 | 4 | -0.25 | -0.10 | 25% |
| hora de abertura (UTC) | 16-24 | 11 | -0.92 | -0.74 | 0% |
| duração | 3-8 velas | 3 | -1.08 | -0.93 | 0% |
| duração | >8 velas | 10 | -0.20 | -0.03 | 30% |
| duração | ≤2 velas | 6 | -1.10 | -0.92 | 0% |

## Velas de 1d

### B1. A entrada tem vantagem, antes de saídas e custos? (1d)

- GOLD: 102 sinais brutos, 23 sem sobreposição (1 por 48 velas).
- EURUSD: 132 sinais brutos, 30 sem sobreposição (1 por 48 velas).

| mercado | horizonte (velas) | sinais | compra/venda | retorno futuro médio (R) | t | aleatório: média ± desvio (R) | p (vs aleatório) | E-ratio | E-ratio aleatório | p do E-ratio | custo ida-e-volta (R) | p Holm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GOLD | 1 | 23 | 13/10 | +0.04 | 0.60 | +0.00 ± 0.06 | 0.289 | 0.87 | 1.07 | 0.677 | 0.11 | 1.000 |
| GOLD | 2 | 23 | 13/10 | +0.06 | 0.54 | +0.01 ± 0.09 | 0.270 | 1.15 | 1.08 | 0.348 | 0.11 | 1.000 |
| GOLD | 4 | 23 | 13/10 | +0.17 | 1.12 | +0.01 ± 0.13 | 0.104 | 1.29 | 1.08 | 0.235 | 0.11 | 1.000 |
| GOLD | 6 | 23 | 13/10 | +0.14 | 0.74 | +0.01 ± 0.16 | 0.215 | 1.49 | 1.11 | 0.146 | 0.11 | 1.000 |
| GOLD | 12 | 23 | 13/10 | -0.07 | -0.32 | +0.02 ± 0.24 | 0.642 | 1.39 | 1.10 | 0.200 | 0.11 | 1.000 |
| GOLD | 24 | 23 | 13/10 | -0.02 | -0.05 | +0.06 ± 0.35 | 0.584 | 1.06 | 1.14 | 0.503 | 0.11 | 1.000 |
| GOLD | 48 | 23 | 13/10 | +0.15 | 0.29 | +0.11 ± 0.55 | 0.471 | 1.61 | 1.18 | 0.171 | 0.11 | 1.000 |
| EURUSD | 1 | 30 | 12/18 | -0.02 | -0.31 | -0.00 ± 0.06 | 0.615 | 0.65 | 1.03 | 0.880 | 0.19 | 1.000 |
| EURUSD | 2 | 30 | 12/18 | -0.10 | -0.87 | -0.00 ± 0.08 | 0.878 | 0.86 | 1.02 | 0.634 | 0.19 | 1.000 |
| EURUSD | 4 | 30 | 12/18 | -0.17 | -1.29 | +0.01 ± 0.12 | 0.933 | 0.85 | 1.03 | 0.646 | 0.19 | 1.000 |
| EURUSD | 6 | 30 | 12/18 | -0.22 | -1.46 | +0.00 ± 0.14 | 0.943 | 0.72 | 1.03 | 0.826 | 0.19 | 1.000 |
| EURUSD | 12 | 30 | 12/18 | -0.08 | -0.38 | +0.01 ± 0.19 | 0.682 | 0.89 | 1.02 | 0.591 | 0.19 | 1.000 |
| EURUSD | 24 | 30 | 12/18 | -0.07 | -0.34 | -0.00 ± 0.27 | 0.607 | 0.95 | 1.00 | 0.503 | 0.19 | 1.000 |
| EURUSD | 48 | 30 | 12/18 | +0.14 | 0.41 | -0.01 ± 0.36 | 0.344 | 1.18 | 0.98 | 0.215 | 0.19 | 1.000 |

«R» = retorno do ativo na direção do sinal, medido da abertura seguinte, em unidades de 2×ATR. «Aleatório» = o mesmo nº de entradas (mesma proporção de compras) em instantes ao acaso, 3 000 sorteios. O custo de ida e volta é o do bot (12 bps por lado incluindo slippage).

### B2. Experiências controladas, um fator de cada vez (1d)

| experiência | trades | R médio | R bruto | resultado | queda | Δ retorno diário vs referência | t | p (variante > ref.) | p Holm | Δ dev/val | veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **REFERÊNCIA (regra atual)** | 129 | -0.14 | -0.02 | -16.6% | 19.0% | — | — | — | — | — | — |
| confirmação: fecho +0,25 ATR além do nível | 90 | -0.11 | +0.01 | -9.5% | 11.1% | +0.4 bp | 1.91 | 0.028 | 0.504 | +/+ | sem diferença detetável |
| confirmação: +0,5 ATR | 45 | -0.01 | +0.11 | -0.7% | 3.3% | +0.9 bp | 2.73 | 0.003 | 0.069 | +/+ | sem diferença detetável |
| confirmação: +1 ATR | 18 | -0.09 | +0.03 | -1.6% | 3.1% | +0.9 bp | 2.55 | 0.005 | 0.110 | +/+ | sem diferença detetável |
| rejeitar rompimento esticado (>1 ATR do nível) | 118 | -0.14 | -0.02 | -15.2% | 18.2% | +0.1 bp | 0.62 | 0.241 | 1.000 | +/+ | sem diferença detetável |
| rejeitar esticado (>2 ATR) | 129 | -0.14 | -0.02 | -16.6% | 19.0% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| sem filtro de tendência | 177 | -0.16 | -0.04 | -25.3% | 26.7% | -0.6 bp | -3.12 | 1.000 | 1.000 | −/− | pior |
| tendência EMA 10/30 | 154 | -0.13 | -0.01 | -18.1% | 19.8% | -0.1 bp | -0.58 | 0.728 | 1.000 | −/+ | sem diferença detetável |
| tendência EMA 50/200 | 90 | -0.14 | -0.01 | -11.9% | 15.8% | +0.3 bp | 1.41 | 0.081 | 1.000 | +/− | sem diferença detetável |
| ADX ≥ 20 | 88 | -0.16 | -0.05 | -13.6% | 16.5% | +0.2 bp | 0.89 | 0.185 | 1.000 | +/+ | sem diferença detetável |
| ADX ≥ 25 | 59 | -0.10 | +0.01 | -5.7% | 11.0% | +0.7 bp | 2.20 | 0.010 | 0.220 | +/+ | sem diferença detetável |
| ADX ≥ 30 | 43 | -0.14 | -0.03 | -5.9% | 10.2% | +0.6 bp | 2.03 | 0.018 | 0.342 | +/+ | sem diferença detetável |
| volatilidade: ATR% acima da mediana | 57 | -0.15 | -0.04 | -8.4% | 9.6% | +0.5 bp | 1.88 | 0.037 | 0.592 | +/+ | sem diferença detetável |
| volatilidade: ATR% baixo (compressão) | 36 | -0.24 | -0.11 | -8.5% | 8.5% | +0.5 bp | 1.54 | 0.062 | 0.937 | +/+ | sem diferença detetável |
| vela de expansão (≥1,5 ATR) | 70 | +0.01 | +0.13 | 0.8% | 5.8% | +1.0 bp | 3.14 | <0.001 | 0.013 | +/+ | **melhora** |
| volume ≥ 1,5× média de 20 | 54 | -0.03 | +0.07 | -1.8% | 7.0% | +0.9 bp | 3.20 | <0.001 | 0.013 | +/+ | **melhora** |
| momentum: ROC(10) concorda | 129 | -0.14 | -0.02 | -16.6% | 19.0% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| momentum: RSI(14) >55/<45 | 129 | -0.14 | -0.02 | -16.6% | 19.0% | +0.0 bp | — | 1.000 | 1.000 | −/− | sem diferença detetável |
| reteste do nível (≤6 velas) | 158 | -0.11 | +0.00 | -16.5% | 19.9% | +0.0 bp | 0.01 | 0.508 | 1.000 | −/+ | sem diferença detetável |
| rompimento de 10 velas | 159 | -0.14 | -0.03 | -20.9% | 23.2% | -0.3 bp | -1.56 | 0.941 | 1.000 | −/− | sem diferença detetável |
| rompimento de 40 velas | 104 | -0.10 | +0.02 | -9.7% | 13.7% | +0.4 bp | 2.25 | 0.011 | 0.230 | +/+ | sem diferença detetável |
| rompimento de 55 velas | 97 | -0.10 | +0.01 | -9.7% | 12.6% | +0.4 bp | 1.93 | 0.032 | 0.552 | +/+ | sem diferença detetável |
| saída B: stop 2, alvo 1,5 | 139 | -0.10 | +0.01 | -13.0% | 14.0% | +0.2 bp | 1.47 | 0.068 | 0.959 | +/+ | sem diferença detetável |
| saída C: stop 3, stop móvel 3 | 92 | -0.15 | -0.05 | -13.3% | 15.5% | +0.2 bp | 0.53 | 0.286 | 1.000 | −/+ | sem diferença detetável |
| saída E: stop 3, canal oposto | 89 | -0.22 | -0.12 | -18.2% | 20.1% | -0.1 bp | -0.19 | 0.576 | 1.000 | −/+ | sem diferença detetável |
| saída F: break-even a 1,5 ATR | 120 | -0.12 | -0.00 | -14.0% | 15.8% | +0.2 bp | 0.65 | 0.272 | 1.000 | +/+ | sem diferença detetável |
| execução: ordens limitadas (maker) | 120 | -0.04 | +0.03 | -5.2% | 8.6% | +0.7 bp | 2.59 | 0.002 | 0.048 | +/+ | **melhora** |

Veredicto «melhora» exige Holm < 0,05 **e** diferença positiva no desenvolvimento e na validação. Nº de experiências corrigidas: 26. Δ em pontos-base de retorno diário médio da conta.

### B3. Onde perde a referência? (1d)

| dimensão | grupo | trades | R líquido | R bruto | acerto |
|---|---|---|---|---|---|
| direção | compra | 63 | -0.10 | +0.02 | 37% |
| direção | venda | 66 | -0.18 | -0.05 | 35% |
| mercado | EURUSD | 55 | -0.18 | -0.03 | 33% |
| mercado | GOLD | 74 | -0.11 | -0.01 | 38% |
| saída | stop-loss | 18 | -1.08 | -0.93 | 0% |
| saída | take-profit | 7 | +1.49 | +1.56 | 100% |
| saída | time-stop | 104 | -0.08 | +0.03 | 38% |
| volatilidade (ATR%) | 1/3 alto | 42 | -0.13 | -0.05 | 31% |
| volatilidade (ATR%) | 1/3 baixo | 44 | -0.16 | +0.01 | 41% |
| volatilidade (ATR%) | 1/3médio | 43 | -0.13 | -0.02 | 35% |
| duração | 3-8 velas | 117 | -0.13 | -0.01 | 36% |
| duração | ≤2 velas | 12 | -0.23 | -0.10 | 33% |
