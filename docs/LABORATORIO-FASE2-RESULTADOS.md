<!-- Relatórios gerados por scripts/lab2.mjs. Partes A, B e C: workflow «Laboratório fase 2», execução 39593891475 (commit b165e0a, 2026-10-21 11:42 UTC). Parte D: execução 39595632566 (commit 8d00245, 11:55 UTC).
     Cópia integral de lab-results/fase2/2026-10-21_1147-b165e0a e lab-results/fase2/2026-10-21_1156-8d00245. Hipóteses e regras: docs/PREREGISTO-FASE2.md (enviado às 11:35 UTC; adenda 1 às 11:52 UTC, antes da Parte D). -->

# Parte A — Auditoria das 1 655 experiências

Todas as configurações foram simuladas outra vez com o motor atual, **só até ao fim da validação** (o teste final continua intacto). Corrida adicional **sem custos** (taxa 0, slippage 0) para medir se há previsibilidade bruta, e as mesmas configurações em dados baralhados (controlo).

## A1. Quantas estratégias verdadeiramente distintas?

| velas | configurações | famílias | combinações família×parâmetros | sem nenhum sinal | conjuntos de sinais de entrada distintos | elegíveis (≥40 trades) | grupos efetivos (corr ≥0,8) | (≥0,9) | (≥0,95) |
|---|---|---|---|---|---|---|---|---|---|
| 1h | 540 | 26 | 108 | 0 | 106 | 245 | 169 | 210 | 231 |
| 4h | 595 | 28 | 119 | 1 | 116 | 528 | 383 | 459 | 480 |
| 1d | 520 | 24 | 104 | 2 | 100 | 389 | 183 | 282 | 345 |

Resposta: 29 famílias; 1655 configurações são combinações de **322 conjuntos de sinais de entrada realmente distintos** (as outras variam só a saída, que muda o que acontece depois da entrada mas não a entrada). Ver quais famílias dão exatamente os mesmos sinais:

- 1h: brk_ema|brk=20 = don|N=20,tr=1
- 1h: brk_ema|brk=40 = don|N=40,tr=1
- 4h: brk_ema|brk=20 = don|N=20,tr=1
- 4h: brk_ema|brk=40 = don|N=40,tr=1
- 1d: brk_ema|brk=20 = don|N=20,tr=1
- 1d: brk_ema|brk=40 = don|N=40,tr=1

Para testes múltiplos o número que conta não é o das configurações, é o dos grupos efetivos com resultados diários correlacionados (colunas à direita; o laboratório usou ≥0,9).

## A2/A3. Por mercado, tamanho de vela e período (todas as configurações, trades de desenvolvimento+validação)

| velas | grupo | trades (todas as configs) | R médio por trade | trades >0 |
|---|---|---|---|---|
| 1h | EURUSD | 3580 | -0.27 | 30% |
| 1h | GOLD | 22908 | -0.20 | 32% |
| 1h | compra | 13088 | -0.08 | 36% |
| 1h | dev | 15217 | -0.22 | 31% |
| 1h | val | 11271 | -0.19 | 32% |
| 1h | venda | 13400 | -0.33 | 27% |
| 4h | EURUSD | 22052 | -0.26 | 29% |
| 4h | GOLD | 78602 | -0.17 | 34% |
| 4h | compra | 51741 | -0.12 | 36% |
| 4h | dev | 72244 | -0.21 | 32% |
| 4h | val | 28410 | -0.14 | 35% |
| 4h | venda | 48913 | -0.26 | 29% |
| 1d | EURUSD | 26208 | -0.18 | 36% |
| 1d | GOLD | 27657 | -0.08 | 40% |
| 1d | compra | 27646 | -0.10 | 40% |
| 1d | dev | 35609 | -0.12 | 38% |
| 1d | val | 18256 | -0.13 | 38% |
| 1d | venda | 26219 | -0.15 | 37% |

Nota: cada trade conta tantas vezes quantas as configurações que a abriram; serve para ver **onde** está o resultado, não para medir significância.

## A4. Principais fatores das perdas (decomposição por trade, em R)

| velas | grupo | trades | R bruto | taxas | slippage | R líquido | trades com bruto>0 mas líquido≤0 |
|---|---|---|---|---|---|---|---|
| 1h | todas | 26488 | -0.04 | -0.12 | -0.05 | -0.21 | 10% |
| 1h | saída A | 2574 | -0.03 | -0.11 | -0.04 | -0.18 | 5% |
| 1h | saída B | 2782 | -0.05 | -0.11 | -0.04 | -0.20 | 8% |
| 1h | saída C | 9917 | -0.02 | -0.12 | -0.05 | -0.19 | 7% |
| 1h | saída E | 8644 | -0.06 | -0.12 | -0.04 | -0.23 | 11% |
| 1h | saída F | 2571 | -0.09 | -0.11 | -0.04 | -0.24 | 21% |
| 4h | todas | 100654 | -0.04 | -0.11 | -0.04 | -0.19 | 11% |
| 4h | saída A | 17268 | -0.02 | -0.11 | -0.04 | -0.17 | 10% |
| 4h | saída B | 20098 | -0.00 | -0.11 | -0.04 | -0.15 | 12% |
| 4h | saída C | 23202 | -0.08 | -0.10 | -0.04 | -0.23 | 6% |
| 4h | saída E | 23998 | -0.05 | -0.10 | -0.04 | -0.19 | 10% |
| 4h | saída F | 16088 | -0.04 | -0.11 | -0.04 | -0.20 | 20% |
| 1d | todas | 53865 | -0.02 | -0.08 | -0.03 | -0.13 | 9% |
| 1d | saída A | 12180 | -0.01 | -0.09 | -0.03 | -0.13 | 10% |
| 1d | saída B | 12352 | +0.00 | -0.08 | -0.03 | -0.11 | 10% |
| 1d | saída C | 8680 | -0.04 | -0.07 | -0.03 | -0.14 | 5% |
| 1d | saída E | 9183 | -0.03 | -0.07 | -0.02 | -0.13 | 5% |
| 1d | saída F | 11470 | -0.01 | -0.09 | -0.03 | -0.13 | 12% |

## A5. As métricas estão calculadas corretamente? De onde vem o limiar de 3,4–3,7?

| velas | elegíveis | grupos efetivos | z Bonferroni (N=elegíveis) | z Bonferroni (N=grupos) = limiar usado | erro máx. do t (Welford vs código) | razão SE por clusters de mês / SE ingénuo (15 melhores) | Reality Check/SPA reais: melhor t / p(RC) / p(SPA) | controlo baralhado: melhor t / p(RC) / p(SPA) |
|---|---|---|---|---|---|---|---|---|
| 1h | 245 | 210 | 3.53 | 3.49 | 0.000000000000 | 0.91 | 1.80 / 0.739 / 0.855 | 1.06 / 0.817 / 0.960 |
| 4h | 528 | 459 | 3.73 | 3.70 | 0.000000000000 | 0.88 | 0.77 / 1.000 / 1.000 | 1.19 / 1.000 / 1.000 |
| 1d | 389 | 282 | 3.66 | 3.57 | 0.000000000000 | 0.96 | 0.68 / 1.000 / 1.000 | 1.15 / 1.000 / 1.000 |

Leitura: (1) o t do código coincide com o cálculo independente; (2) o limiar vem de dividir 5 % (unilateral) pelo nº de grupos efetivos, z = Φ⁻¹(1 − 0,05/N); (3) se a razão dos erros-padrão for >1, o t ingénuo **sobrestima** a significância (as trades vizinhas não são independentes), por isso o limiar de 3,4–3,7 não é excessivo; (4) o *Reality Check* e o SPA (bootstrap estacionário sobre as séries diárias de todas as configurações elegíveis) dão uma segunda opinião sobre o melhor resultado, sem depender do número de grupos.

## A6. O tamanho da amostra chega? (poder estatístico)

| velas | elegíveis | trades (mediana) | desvio do R por trade (média) | vantagem mínima detetável (R, mediana; poder 80%) | intervalo p10…p90 | trades necessários para detetar +0,15 R |
|---|---|---|---|---|---|---|
| 1h | 245 | 71 | 0.94 | +0.44 | +0.27 … +0.75 | 743 |
| 4h | 528 | 164 | 0.77 | +0.27 | +0.15 … +0.46 | 544 |
| 1d | 389 | 115 | 0.63 | +0.26 | +0.16 … +0.39 | 343 |

Conclusão: o laboratório só detetaria vantagens **grandes** (acima do valor da coluna «mínima detetável»). Uma vantagem verdadeira de +0,15 R por trade precisaria de muitas mais trades por configuração do que as que existem. Por isso um resultado nulo aqui é **inconclusivo para vantagens pequenas**.

## A7. Existe previsibilidade bruta (sem custos)?

| velas | configs (reais, sem custos) | t agrupado: mediana · p90 · p99 · máx | com t>3,5 | configs (controlo) | t controlo: mediana · p90 · p99 · máx | controlo com t>3,5 | RC/SPA reais | RC/SPA controlo |
|---|---|---|---|---|---|---|---|---|
| 1h | 530 | -0.54 · 1.46 · 3.25 · 4.47 | 3 | 530 | -0.34 · 1.04 · 1.88 · 2.60 | 0 | 0.008 / 0.012 | 0.693 / 0.950 |
| 4h | 571 | -0.93 · 0.91 · 2.20 · 2.85 | 0 | 575 | -0.70 · 0.80 · 1.81 · 2.92 | 0 | 0.489 / 0.162 | 0.056 / 0.315 |
| 1d | 403 | -0.32 · 0.73 · 1.65 · 2.11 | 0 | 412 | -0.33 · 0.77 · 1.61 · 2.01 | 0 | 0.651 / 0.834 | 0.982 / 0.922 |

As 10 configurações com maior t **sem custos** (previsibilidade bruta), em desenvolvimento+validação:

| velas | configuração | trades | R médio bruto | t |
|---|---|---|---|---|
| 1h | ml[hz=12,thr=0.55]/B | 2049 | +0.08 | 4.47 |
| 1h | rsi[set=2/10/90,filt=0]/E | 4139 | +0.03 | 3.98 |
| 1h | ml[hz=12,thr=0.6]/B | 1024 | +0.10 | 3.87 |
| 1h | rsi[set=2/10/90,filt=1]/E | 1382 | +0.04 | 3.43 |
| 1h | rsi[set=2/10/90,filt=1]/B | 1197 | +0.08 | 3.25 |
| 1h | ml[hz=12,thr=0.55]/F | 1413 | +0.09 | 3.25 |
| 1h | ml[hz=6,thr=0.55]/B | 2147 | +0.06 | 3.23 |
| 1h | stoch[lo=20,filt=1]/B | 351 | +0.13 | 3.04 |
| 1h | rsi[set=3/15/85,filt=1]/B | 665 | +0.09 | 2.96 |
| 1h | rsi[set=3/15/85,filt=0]/E | 2741 | +0.03 | 2.95 |


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


# Parte C — Swing diário e outras hipóteses de tendência em dados independentes

Hipóteses, dados e regras de decisão: `docs/PREREGISTO-FASE2.md` (enviado antes desta corrida). Cada série é simulada em separado (conta $10 000, risco 1 %, alavancagem máx. 5×).

| série | período usado | barras | nota |
|---|---|---|---|
| S&P 500 (índice) | 1970-01-02 → 2026-10-20 | 14322 | Yahoo: 14322 linhas, 0 removidas, 0 com high/low corrigidos |
| ouro (GLD) até 2020-08-27 | 2004-11-18 → 2020-08-27 | 3971 | Yahoo: 5514 linhas, 0 removidas, 0 com high/low corrigidos |
| EUR/USD até 2019-12-31 | 2003-12-01 → 2019-12-31 | 4168 | Yahoo: 5974 linhas, 35 removidas, 128 com high/low corrigidos |
| USD/JPY | 1996-10-30 → 2026-10-21 | 7773 | Yahoo: 7822 linhas, 49 removidas, 278 com high/low corrigidos |
| obrigações longas (TLT) | 2002-07-30 → 2026-10-20 | 6096 | Yahoo: 6096 linhas, 0 removidas, 0 com high/low corrigidos |
| Bitcoin | 2014-09-17 → 2026-10-21 | 4418 | Yahoo: 4418 linhas, 0 removidas, 0 com high/low corrigidos |
| Ethereum | 2017-11-09 → 2026-10-21 | 3269 | Yahoo: 3269 linhas, 0 removidas, 0 com high/low corrigidos |

## H1 — Swing diário de produção (compra e venda)

Configuração: `brk_ema[brk=20]/S`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 379 | -0.02 | 34% | -11.0% | 27.0% | 8277.8% | 188: -0.02 · 191: -0.03 |
| GLD | 108 | +0.17 | 37% | 17.9% | 10.7% | 307.9% | 57: +0.07 · 51: +0.27 |
| EURUSD | 84 | -0.24 | 27% | -19.1% | 20.9% | -6.9% | 46: -0.23 · 38: -0.26 |
| JPY | 151 | -0.01 | 37% | -2.9% | 19.5% | 38.1% | 95: -0.11 · 56: +0.17 |
| TLT | 181 | -0.11 | 30% | -19.3% | 28.1% | -2.0% | 85: -0.06 · 96: -0.15 |
| BTC | 59 | +1.21 | 54% | 100.1% | 5.3% | 17787.8% | 32: +1.58 · 27: +0.78 |
| ETH | 10 | +1.03 | 50% | 10.5% | 5.3% | 696.6% | 2: +3.14 · 8: +0.50 |

**Agrupado (7 séries):** 972 trades, R médio **+0.05**, IC95 % por clusters de mês [-0.05, +0.16], t = 0.99, p unilateral = 0.164 (496 meses). Desvio do R: 1.61; percentis 5/25/50/75/95: -1.11 · -1.06 · -0.72 · +0.80 · +3.42.

Compras: 592 trades, +0.20 R · Vendas: 380 trades, -0.18 R. Sem as 3 melhores trades: +0.03 R. Os 10 % melhores trades dão 514% do resultado total. Custos ×2 (18 bps): -0.08 R · custos 3 bps: +0.13 R.

## H2 — Donchian 55 + EMA 20/50, stop móvel 3×ATR

Configuração: `don[N=55,tr=1]/C`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 371 | -0.00 | 42% | -2.7% | 13.2% | 8277.8% | 172: +0.01 · 199: -0.01 |
| GLD | 101 | +0.04 | 39% | 3.9% | 9.3% | 307.9% | 49: +0.07 · 52: +0.02 |
| EURUSD | 83 | -0.13 | 39% | -10.2% | 12.9% | -6.9% | 46: -0.16 · 37: -0.08 |
| JPY | 152 | -0.03 | 38% | -5.7% | 12.6% | 38.1% | 85: -0.10 · 67: +0.04 |
| TLT | 147 | -0.05 | 39% | -7.4% | 16.7% | -2.0% | 73: +0.01 · 74: -0.11 |
| BTC | 39 | +0.87 | 56% | 39.3% | 4.1% | 17787.8% | 19: +1.38 · 20: +0.38 |
| ETH | 8 | +0.55 | 50% | 4.4% | 3.3% | 696.6% | 1: +2.41 · 7: +0.28 |

**Agrupado (7 séries):** 901 trades, R médio **+0.02**, IC95 % por clusters de mês [-0.04, +0.09], t = 0.61, p unilateral = 0.271 (464 meses). Desvio do R: 1.01; percentis 5/25/50/75/95: -1.04 · -0.78 · -0.28 · +0.58 · +1.92.

Compras: 583 trades, +0.09 R · Vendas: 318 trades, -0.11 R. Sem as 3 melhores trades: +0.00 R. Os 10 % melhores trades dão 930% do resultado total. Custos ×2 (18 bps): -0.05 R · custos 3 bps: +0.08 R.

## H3 — Momentum de série temporal (120 velas)

Configuração: `tsmom[Ldays=120]/C`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 425 | -0.01 | 43% | -6.1% | 20.6% | 8277.8% | 206: +0.00 · 219: -0.02 |
| GLD | 120 | +0.00 | 41% | -0.6% | 13.4% | 307.9% | 52: +0.09 · 68: -0.07 |
| EURUSD | 109 | -0.10 | 44% | -10.9% | 12.9% | -6.9% | 53: -0.04 · 56: -0.16 |
| JPY | 232 | -0.07 | 38% | -14.9% | 22.9% | 38.1% | 112: -0.10 · 120: -0.04 |
| TLT | 199 | -0.07 | 39% | -14.2% | 17.2% | -2.0% | 100: -0.04 · 99: -0.11 |
| BTC | 59 | +0.67 | 51% | 47.2% | 3.4% | 17787.8% | 34: +0.79 · 25: +0.51 |
| ETH | 13 | +0.46 | 38% | 5.9% | 4.1% | 696.6% | 2: +1.58 · 11: +0.25 |

**Agrupado (7 séries):** 1157 trades, R médio **+0.00**, IC95 % por clusters de mês [-0.06, +0.06], t = 0.00, p unilateral = 0.492 (505 meses). Desvio do R: 0.99; percentis 5/25/50/75/95: -1.04 · -0.80 · -0.30 · +0.55 · +1.93.

Compras: 689 trades, +0.09 R · Vendas: 468 trades, -0.13 R. Sem as 3 melhores trades: -0.01 R. Os 10 % melhores trades dão 4010% do resultado total. Custos ×2 (18 bps): -0.07 R · custos 3 bps: +0.06 R.

## H4 — Só comprado acima da EMA 200

Configuração: `long200[N=200]/E`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 207 | +0.10 | 32% | 23.6% | 5.7% | 8277.8% | 94: +0.21 · 113: +0.02 |
| GLD | 52 | +0.23 | 37% | 12.4% | 2.9% | 307.9% | 19: +0.31 · 33: +0.19 |
| EURUSD | 69 | -0.14 | 22% | -9.6% | 10.3% | -6.9% | 33: -0.14 · 36: -0.15 |
| JPY | 166 | -0.18 | 22% | -26.3% | 27.3% | 38.1% | 87: -0.23 · 79: -0.13 |
| TLT | 138 | -0.14 | 25% | -17.6% | 21.0% | -2.0% | 70: +0.00 · 68: -0.28 |
| BTC | 13 | +1.31 | 46% | 17.8% | 1.9% | 17787.8% | 4: +3.02 · 9: +0.55 |
| ETH | 3 | +1.39 | 100% | 4.2% | 0.9% | 696.6% | 0: — · 3: +1.39 |

**Agrupado (7 séries):** 648 trades, R médio **-0.01**, IC95 % por clusters de mês [-0.07, +0.06], t = -0.19, p unilateral = 0.581 (323 meses). Desvio do R: 0.82; percentis 5/25/50/75/95: -0.78 · -0.40 · -0.21 · +0.06 · +1.43.

Compras: 648 trades, -0.01 R · Vendas: 0 trades, — R. Sem as 3 melhores trades: -0.04 R. Os 10 % melhores trades dão 2693% do resultado total. Custos ×2 (18 bps): -0.06 R · custos 3 bps: +0.06 R.

## REF — Referência: rompimento atual do bot (não é hipótese)

Configuração: `brk_ema[brk=20]/A`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 983 | -0.12 | 42% | -71.0% | 71.6% | 8277.8% | 437: -0.09 · 546: -0.15 |
| GLD | 265 | -0.08 | 45% | -19.0% | 22.3% | 307.9% | 140: -0.06 · 125: -0.10 |
| EURUSD | 172 | -0.18 | 34% | -26.9% | 26.9% | -6.9% | 102: -0.21 · 70: -0.14 |
| JPY | 349 | -0.14 | 36% | -38.4% | 39.3% | 38.1% | 219: -0.15 · 130: -0.12 |
| TLT | 422 | -0.16 | 40% | -48.8% | 49.8% | -2.0% | 199: -0.15 · 223: -0.16 |
| BTC | 110 | +0.37 | 65% | 49.0% | 2.5% | 17787.8% | 64: +0.39 · 46: +0.34 |
| ETH | 13 | +0.59 | 69% | 8.0% | 2.2% | 696.6% | 3: +1.49 · 10: +0.32 |

**Agrupado (7 séries):** 2314 trades, R médio **-0.10**, IC95 % por clusters de mês [-0.13, -0.08], t = -8.34, p unilateral = 1.000 (571 meses). Desvio do R: 0.63; percentis 5/25/50/75/95: -1.08 · -0.48 · -0.11 · +0.24 · +1.04.

Compras: 1559 trades, -0.09 R · Vendas: 755 trades, -0.14 R. Sem as 3 melhores trades: -0.11 R. Os 10 % melhores trades dão -151% do resultado total. Custos ×2 (18 bps): -0.22 R · custos 3 bps: -0.03 R.

## Decisão (regras de `PREREGISTO-FASE2.md` §1)

| id | hipótese | trades | R médio | IC95 % | t | p | p Holm (4) | 1) t≥1,645 corrigido | 2) ≥2/3 séries >0 | 3) custos ×2 >0 | 4) sem top-3 >0 | 5) queda ≤25 % | 6) duas metades >0 | classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H1 | Swing diário de produção (compra e venda) | 972 | +0.05 | [-0.05, +0.16] | 0.99 | 0.164 | 0.655 | não | 3/7 não | não | sim | não | 2/6 não | inconclusiva |
| H2 | Donchian 55 + EMA 20/50, stop móvel 3×ATR | 901 | +0.02 | [-0.04, +0.09] | 0.61 | 0.271 | 0.814 | não | 2/6 não | não | sim | sim | 2/6 não | inconclusiva |
| H3 | Momentum de série temporal (120 velas) | 1157 | +0.00 | [-0.06, +0.06] | 0.00 | 0.492 | 0.983 | não | 3/7 não | não | não | sim | 1/6 não | inconclusiva |
| H4 | Só comprado acima da EMA 200 | 648 | -0.01 | [-0.07, +0.06] | -0.19 | 0.581 | 0.983 | não | 3/6 não | não | não | não | 2/5 não | rejeitada |

Poder: para detetar +0,15 R com desvio 1,3 R a t = 1,645 são precisos cerca de **204 trades agrupados**; cada hipótese teve H1: 972, H2: 901, H3: 1157, H4: 648.

## H1: estabilidade por ano (séries independentes juntas)

| ano | trades | R médio |
|---|---|---|
| 1970 | 4 | +0.95 |
| 1971 | 5 | +0.29 |
| 1972 | 4 | -0.08 |
| 1973 | 9 | -0.55 |
| 1974 | 6 | -0.27 |
| 1975 | 4 | +0.55 |
| 1976 | 5 | -0.21 |
| 1977 | 6 | -0.24 |
| 1978 | 5 | +0.21 |
| 1979 | 6 | -0.74 |
| 1980 | 6 | +0.09 |
| 1981 | 4 | -0.39 |
| 1982 | 8 | +0.08 |
| 1983 | 12 | -0.60 |
| 1984 | 8 | -0.18 |
| 1985 | 8 | +0.93 |
| 1986 | 8 | -0.30 |
| 1987 | 6 | +1.96 |
| 1988 | 6 | -0.52 |
| 1989 | 9 | +0.08 |
| 1990 | 9 | -0.51 |
| 1991 | 7 | -0.02 |
| 1992 | 8 | -0.73 |
| 1993 | 5 | -0.54 |
| 1994 | 7 | -0.60 |
| 1995 | 10 | +0.31 |
| 1996 | 5 | +1.20 |
| 1997 | 15 | +0.05 |
| 1998 | 10 | +0.44 |
| 1999 | 14 | -0.09 |
| 2000 | 15 | -0.75 |
| 2001 | 10 | +0.84 |
| 2002 | 16 | +0.21 |
| 2003 | 20 | -0.10 |
| 2004 | 30 | -0.33 |
| 2005 | 38 | -0.26 |
| 2006 | 34 | -0.20 |
| 2007 | 30 | +0.11 |
| 2008 | 32 | -0.34 |
| 2009 | 28 | +0.24 |
| 2010 | 34 | +0.02 |
| 2011 | 33 | -0.13 |
| 2012 | 31 | -0.04 |
| 2013 | 32 | -0.08 |
| 2014 | 27 | +0.29 |
| 2015 | 37 | +0.02 |
| 2016 | 33 | +0.21 |
| 2017 | 35 | +0.58 |
| 2018 | 32 | +0.23 |
| 2019 | 33 | +0.42 |
| 2020 | 31 | +0.55 |
| 2021 | 19 | +0.03 |
| 2022 | 22 | -0.08 |
| 2023 | 30 | +0.15 |
| 2024 | 21 | +1.03 |
| 2025 | 31 | -0.36 |
| 2026 | 19 | +0.18 |

Anos com R médio > 0: 29 de 57.

## H1: sensibilidade aos parâmetros (séries independentes juntas; 27 combinações à volta da regra de produção)

| rompimento | stop (ATR) | stop móvel (ATR) | trades | R médio | t | IC95 % inf. | IC95 % sup. |
|---|---|---|---|---|---|---|---|
| 10 | 1.5 | 2 | 1235 | -0.05 | -1.06 | -0.13 | +0.04 |
| 10 | 1.5 | 3 | 1049 | +0.04 | 0.66 | -0.08 | +0.17 |
| 10 | 1.5 | 4 | 984 | +0.04 | 0.56 | -0.11 | +0.19 |
| 10 | 2 | 2 | 1419 | -0.04 | -1.26 | -0.10 | +0.03 |
| 10 | 2 | 3 | 1130 | +0.05 | 0.97 | -0.04 | +0.15 |
| 10 | 2 | 4 | 1029 | +0.08 | 1.25 | -0.05 | +0.20 |
| 10 | 3 | 2 | 1457 | -0.03 | -1.39 | -0.07 | +0.01 |
| 10 | 3 | 3 | 1080 | +0.03 | 0.87 | -0.04 | +0.11 |
| 10 | 3 | 4 | 942 | +0.06 | 1.18 | -0.04 | +0.16 |
| 20 | 1.5 | 2 | 1038 | -0.03 | -0.63 | -0.12 | +0.06 |
| 20 | 1.5 | 3 | 886 | +0.05 | 0.75 | -0.08 | +0.18 |
| 20 | 1.5 | 4 | 841 | +0.07 | 0.87 | -0.09 | +0.23 |
| 20 | 2 | 2 | 1217 | -0.05 | -1.44 | -0.12 | +0.02 |
| 20 | 2 | 3 | 972 | +0.05 | 1.00 | -0.05 | +0.15 |
| 20 | 2 | 4 | 903 | +0.07 | 1.19 | -0.05 | +0.19 |
| 20 | 3 | 2 | 1251 | -0.04 | -1.56 | -0.08 | +0.01 |
| 20 | 3 | 3 | 937 | +0.03 | 0.87 | -0.04 | +0.11 |
| 20 | 3 | 4 | 837 | +0.05 | 1.02 | -0.04 | +0.14 |
| 40 | 1.5 | 2 | 879 | -0.01 | -0.26 | -0.12 | +0.10 |
| 40 | 1.5 | 3 | 750 | +0.06 | 0.84 | -0.08 | +0.20 |
| 40 | 1.5 | 4 | 712 | +0.08 | 0.90 | -0.09 | +0.25 |
| 40 | 2 | 2 | 1037 | -0.04 | -1.01 | -0.11 | +0.03 |
| 40 | 2 | 3 | 832 | +0.05 | 0.82 | -0.06 | +0.15 |
| 40 | 2 | 4 | 770 | +0.06 | 0.88 | -0.07 | +0.20 |
| 40 | 3 | 2 | 1069 | -0.03 | -1.07 | -0.08 | +0.02 |
| 40 | 3 | 3 | 805 | +0.04 | 1.09 | -0.03 | +0.12 |
| 40 | 3 | 4 | 722 | +0.05 | 1.02 | -0.05 | +0.15 |

18 de 27 combinações têm R médio > 0 nas séries independentes. (A regra de produção é 20 / 2 / 3.)

## Swing diário em ouro e EUR/USD da Binance (dados já usados no laboratório; **não é evidência independente**)

Período completo: 88 trades, R médio +0.17, IC95 % por clusters [-0.17, +0.55], t = 0.90, queda máx. 13.2%, resultado 14.3%.

| mercado | trades | R médio |
|---|---|---|
| EURUSD | 33 | +0.01 |
| GOLD | 55 | +0.26 |


# Parte D — Filtros do rompimento validados em dados independentes (H5 e H6)

Hipóteses exploratórias fixadas na **Adenda 1** de `docs/PREREGISTO-FASE2.md` (enviada antes desta corrida): derivam da Parte B, por isso o resultado tem de ser lido com essa ressalva. Mesmas séries, janelas, custos e regras de decisão da Parte C, com Holm sobre 2 hipóteses.

## H5 — Rompimento atual + vela de expansão (amplitude ≥ 1,5 ATR)

Configuração: `brkx[N=20,f=20,s=50,conf=0,ext=0,adx=0,vol=exp,surge=0,sess=,mom=,retest=0]/A`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 231 | -0.11 | 43% | -23.7% | 28.6% | 8277.8% | 126: -0.01 · 105: -0.24 |
| GLD | 51 | -0.09 | 47% | -4.7% | 7.1% | 307.9% | 28: -0.01 · 23: -0.20 |
| EURUSD | 33 | -0.30 | 36% | -9.4% | 9.6% | -6.9% | 30: -0.27 · 3: -0.57 |
| JPY | 80 | -0.03 | 45% | -2.2% | 3.8% | 38.1% | 67: -0.01 · 13: -0.08 |
| TLT | 59 | -0.09 | 41% | -5.3% | 10.6% | -2.0% | 38: -0.06 · 21: -0.15 |
| BTC | 79 | +0.34 | 63% | 30.3% | 3.1% | 17809.9% | 48: +0.31 · 31: +0.39 |
| ETH | 10 | +0.62 | 70% | 6.3% | 2.0% | 699.4% | 2: +1.49 · 8: +0.40 |

**Agrupado (7 séries):** 543 trades, R médio **-0.03**, IC95 % por clusters de mês [-0.10, +0.04], t = -0.84, p unilateral = 0.795 (301 meses). Desvio do R: 0.73; percentis 5/25/50/75/95: -1.08 · -0.52 · -0.05 · +0.35 · +1.49.

Compras: 335 trades, -0.01 R · Vendas: 208 trades, -0.06 R. Sem as 3 melhores trades: -0.04 R. Os 10 % melhores trades dão -953% do resultado total. Custos ×2 (18 bps): -0.14 R · custos 3 bps: +0.04 R.

## H6 — Rompimento atual + volume ≥ 1,5× média de 20 (só séries com volume)

Configuração: `brkx[N=20,f=20,s=50,conf=0,ext=0,adx=0,vol=,surge=1.5,sess=,mom=,retest=0]/A`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 67 | +0.02 | 54% | 1.3% | 6.5% | 8277.8% | 39: +0.16 · 28: -0.17 |
| GLD | 134 | -0.11 | 46% | -13.6% | 16.1% | 307.9% | 63: -0.06 · 71: -0.15 |
| EURUSD | 0 | — | 0% | 0.0% | 0.0% | -6.9% | 0: — · 0: — |
| JPY | 0 | — | 0% | 0.0% | 0.0% | 38.1% | 0: — · 0: — |
| TLT | 189 | -0.14 | 40% | -24.1% | 26.4% | -2.0% | 100: -0.12 · 89: -0.17 |
| BTC | 50 | +0.34 | 66% | 18.0% | 2.4% | 17809.9% | 26: +0.34 · 24: +0.33 |
| ETH | 8 | +0.35 | 63% | 2.8% | 2.0% | 699.4% | 1: +1.49 · 7: +0.19 |

**Agrupado (7 séries):** 448 trades, R médio **-0.05**, IC95 % por clusters de mês [-0.12, +0.02], t = -1.29, p unilateral = 0.905 (232 meses). Desvio do R: 0.71; percentis 5/25/50/75/95: -1.08 · -0.57 · -0.05 · +0.34 · +1.49.

Compras: 272 trades, +0.02 R · Vendas: 176 trades, -0.15 R. Sem as 3 melhores trades: -0.06 R. Os 10 % melhores trades dão -386% do resultado total. Custos ×2 (18 bps): -0.14 R · custos 3 bps: +0.02 R.

## REF — Referência: rompimento atual do bot (não é hipótese)

Configuração: `brk_ema[brk=20]/A`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 983 | -0.12 | 42% | -71.0% | 71.6% | 8277.8% | 437: -0.09 · 546: -0.15 |
| GLD | 265 | -0.08 | 45% | -19.0% | 22.3% | 307.9% | 140: -0.06 · 125: -0.10 |
| EURUSD | 172 | -0.18 | 34% | -26.9% | 26.9% | -6.9% | 102: -0.21 · 70: -0.14 |
| JPY | 349 | -0.14 | 36% | -38.4% | 39.3% | 38.1% | 219: -0.15 · 130: -0.12 |
| TLT | 422 | -0.16 | 40% | -48.8% | 49.8% | -2.0% | 199: -0.15 · 223: -0.16 |
| BTC | 110 | +0.37 | 65% | 49.0% | 2.5% | 17809.9% | 64: +0.39 · 46: +0.34 |
| ETH | 13 | +0.59 | 69% | 8.0% | 2.2% | 699.4% | 3: +1.49 · 10: +0.32 |

**Agrupado (7 séries):** 2314 trades, R médio **-0.10**, IC95 % por clusters de mês [-0.13, -0.08], t = -8.34, p unilateral = 1.000 (571 meses). Desvio do R: 0.63; percentis 5/25/50/75/95: -1.08 · -0.48 · -0.11 · +0.24 · +1.04.

Compras: 1559 trades, -0.09 R · Vendas: 755 trades, -0.14 R. Sem as 3 melhores trades: -0.11 R. Os 10 % melhores trades dão -151% do resultado total. Custos ×2 (18 bps): -0.22 R · custos 3 bps: -0.03 R.

## Decisão (regras de `PREREGISTO-FASE2.md` §1)

| id | hipótese | trades | R médio | IC95 % | t | p | p Holm (2) | 1) t≥1,645 corrigido | 2) ≥2/3 séries >0 | 3) custos ×2 >0 | 4) sem top-3 >0 | 5) queda ≤25 % | 6) duas metades >0 | classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H5 | Rompimento atual + vela de expansão (amplitude ≥ 1,5 ATR) | 543 | -0.03 | [-0.10, +0.04] | -0.84 | 0.795 | 1.000 | não | 2/7 não | não | não | não | 1/6 não | rejeitada |
| H6 | Rompimento atual + volume ≥ 1,5× média de 20 (só séries com volume) | 448 | -0.05 | [-0.12, +0.02] | -1.29 | 0.905 | 1.000 | não | 2/4 não | não | não | não | 1/4 não | rejeitada |

Poder: para detetar +0,15 R com desvio 1,3 R a t = 1,645 são precisos cerca de **204 trades agrupados**; cada hipótese teve H5: 543, H6: 448.

## Comparação com a regra atual (mesmas séries)

| regra | trades | R médio | IC95 % |
|---|---|---|---|
| REF (atual) | 2314 | -0.10 | [-0.13, -0.08] |
| H5 (expansão) | 543 | -0.03 | [-0.10, +0.04] |
| H6 (volume) | 448 | -0.05 | [-0.12, +0.02] |

# Parte E — Regras de tendência a custos de «modo de crescimento» (H7-H10)

Hipóteses fixadas na **Adenda 2** de `docs/PREREGISTO-FASE2.md` (enviada antes desta corrida). Séries: GSPC, EURUSD. Cenário principal: taxa taker 0,9 bps, slippage 3/5 bps. **Os custos reais dos mercados `xyz:EUR` e `xyz:SP500` não estão confirmados**; o resultado só diz se vale a pena confirmá-los.

Filtro de custo fixo em ATR% mínimo = 0.060 % (calculado com 0,9 bps) em todos os cenários, para os sinais serem os mesmos.

## H7 — Swing diário de produção (compra e venda)

Configuração: `brk_ema[brk=20]/S`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 380 | +0.05 | 35% | 16.0% | 18.7% | 8277.8% | 192: +0.04 · 188: +0.06 |
| EURUSD | 93 | -0.10 | 28% | -9.8% | 13.8% | -6.9% | 51: -0.09 · 42: -0.11 |

**Agrupado (2 séries):** 473 trades, R médio **+0.02**, IC95 % por clusters de mês [-0.11, +0.16], t = 0.31, p unilateral = 0.385 (389 meses). Desvio do R: 1.52; percentis 5/25/50/75/95: -1.04 · -1.02 · -0.67 · +0.64 · +3.10.

Compras: 296 trades, +0.15 R · Vendas: 177 trades, -0.20 R. Sem as 3 melhores trades: -0.03 R. Os 10 % melhores trades dão 2692% do resultado total. Cenário ×2 (1,8 bps, slippage 6/10): -0.03 R · slippage curto (1/2 bps): +0.04 R. Sem redução de taxa (9 bps): -0.05 R.

## H8 — Donchian 55 + EMA 20/50, stop móvel 3×ATR

Configuração: `don[N=55,tr=1]/C`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 372 | +0.04 | 44% | 16.4% | 10.4% | 8277.8% | 172: +0.05 · 200: +0.04 |
| EURUSD | 83 | -0.06 | 39% | -5.1% | 9.7% | -6.9% | 46: -0.10 · 37: -0.01 |

**Agrupado (2 séries):** 455 trades, R médio **+0.03**, IC95 % por clusters de mês [-0.05, +0.10], t = 0.66, p unilateral = 0.254 (375 meses). Desvio do R: 0.88; percentis 5/25/50/75/95: -0.98 · -0.68 · -0.22 · +0.59 · +1.65.

Compras: 315 trades, +0.07 R · Vendas: 140 trades, -0.06 R. Sem as 3 melhores trades: +0.00 R. Os 10 % melhores trades dão 757% do resultado total. Cenário ×2 (1,8 bps, slippage 6/10): -0.00 R · slippage curto (1/2 bps): +0.04 R. Sem redução de taxa (9 bps): -0.03 R.

## H9 — Momentum de série temporal (120 velas)

Configuração: `tsmom[Ldays=120]/C`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 425 | +0.03 | 43% | 12.9% | 15.5% | 8277.8% | 206: +0.05 · 219: +0.02 |
| EURUSD | 110 | -0.04 | 45% | -5.1% | 11.5% | -6.9% | 53: +0.02 · 57: -0.11 |

**Agrupado (2 séries):** 535 trades, R médio **+0.02**, IC95 % por clusters de mês [-0.06, +0.09], t = 0.42, p unilateral = 0.330 (414 meses). Desvio do R: 0.88; percentis 5/25/50/75/95: -1.00 · -0.75 · -0.26 · +0.58 · +1.71.

Compras: 344 trades, +0.11 R · Vendas: 191 trades, -0.15 R. Sem as 3 melhores trades: +0.00 R. Os 10 % melhores trades dão 1366% do resultado total. Cenário ×2 (1,8 bps, slippage 6/10): -0.01 R · slippage curto (1/2 bps): +0.03 R. Sem redução de taxa (9 bps): -0.03 R.

## H10 — Só comprado acima da EMA 200

Configuração: `long200[N=200]/E`

| série | trades | R médio | acerto | resultado da conta | queda máx. | comprar e manter | 1.ª metade n: R · 2.ª metade n: R |
|---|---|---|---|---|---|---|---|
| GSPC | 207 | +0.14 | 33% | 34.1% | 4.9% | 8277.8% | 94: +0.25 · 113: +0.05 |
| EURUSD | 72 | -0.08 | 28% | -5.6% | 7.1% | -6.9% | 33: -0.08 · 39: -0.08 |

**Agrupado (2 séries):** 279 trades, R médio **+0.09**, IC95 % por clusters de mês [+0.01, +0.17], t = 2.07, p unilateral = 0.014 (198 meses). Desvio do R: 0.67; percentis 5/25/50/75/95: -0.65 · -0.30 · -0.13 · +0.29 · +1.48.

Compras: 279 trades, +0.09 R · Vendas: 0 trades, — R. Sem as 3 melhores trades: +0.06 R. Os 10 % melhores trades dão 188% do resultado total. Cenário ×2 (1,8 bps, slippage 6/10): +0.06 R · slippage curto (1/2 bps): +0.10 R. Sem redução de taxa (9 bps): +0.04 R.

## Decisão (regras de `PREREGISTO-FASE2.md` §1)

| id | hipótese | trades | R médio | IC95 % | t | p | p Holm (4) | 1) t≥1,645 corrigido | 2) ≥2/3 séries >0 | 3) cenário ×2 >0 | 4) sem top-3 >0 | 5) queda ≤25 % | 6) duas metades >0 | classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H7 | Swing diário de produção (compra e venda) | 473 | +0.02 | [-0.11, +0.16] | 0.31 | 0.385 | 0.763 | não | 1/2 não | não | não | sim | 1/2 não | inconclusiva |
| H8 | Donchian 55 + EMA 20/50, stop móvel 3×ATR | 455 | +0.03 | [-0.05, +0.10] | 0.66 | 0.254 | 0.763 | não | 1/2 não | não | sim | sim | 1/2 não | inconclusiva |
| H9 | Momentum de série temporal (120 velas) | 535 | +0.02 | [-0.06, +0.09] | 0.42 | 0.330 | 0.763 | não | 1/2 não | não | sim | sim | 1/2 não | inconclusiva |
| H10 | Só comprado acima da EMA 200 | 279 | +0.09 | [+0.01, +0.17] | 2.07 | 0.014 | 0.056 | não | 1/2 não | sim | sim | sim | 1/2 não | inconclusiva |

Poder: para detetar +0,15 R com desvio 1,3 R a t = 1,645 são precisos cerca de **204 trades agrupados**; cada hipótese teve H7: 473, H8: 455, H9: 535, H10: 279.
