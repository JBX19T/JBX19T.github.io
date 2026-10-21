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
