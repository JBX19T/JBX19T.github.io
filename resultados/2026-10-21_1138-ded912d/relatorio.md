# Laboratório de estratégias — 2026-10-21T11:35:12.345Z

## 1. Dados e partições (cronológicas)

| velas | mercados | de | fim do desenvolvimento | fim da validação | até | impressão digital dos dados |
|---|---|---|---|---|---|---|
| 1h | GOLD 29999, EURUSD 29999 | 2023-05-20 | 2025-02-03 | 2025-12-12 | 2026-10-21 | 29999:1684584000000:1792576800000:9ad26d97 · 29999:1684584000000:1792576800000:4bbfea3 |
| 4h | GOLD 13469, EURUSD 14897 | 2020-01-03 | 2023-05-28 | 2025-02-07 | 2026-10-21 | 13469:1598616000000:1792555200000:c32acedf · 14897:1578038400000:1792555200000:44a477ff |
| 1d | GOLD 2245, EURUSD 2483 | 2020-01-03 | 2023-05-28 | 2025-02-07 | 2026-10-20 | 2245:1598572800000:1792454400000:a66db71f · 2483:1578009600000:1792454400000:1546028f |

Mercados: ouro = PAXGUSDT e EUR/USD = EURUSDT (Binance spot, proxies). Custos como no bot: taxa taker 9 bps, maker 3 bps, slippage 3 bps (stop 5 bps), risco 1% por trade, alavancagem máx. 5×, filtro de custo por risco ≤15%.

Configurações na biblioteca (30 famílias): 1h: 540 · 4h: 595 · 1d: 520 → 1655.

## 2. Testes múltiplos e distribuição dos resultados (desenvolvimento + validação)

| dados | velas | configs simuladas | elegíveis (≥40 trades) | grupos efetivos (corr. ≥0,9) | limiar t de Bonferroni | positivas em dev **e** val | t agrupado: mediana · p90 · p99 · máx | passam G1-G3+G6 (camada A / B) |
|---|---|---|---|---|---|---|---|---|
| real | 1h | 540 | 245 | 220 | 3.51 | 6 (2%) | -1.92 · -0.47 · 1.06 · 1.71 | 0 / 0 |
| controlo (baralhado) | 1h | 540 | 183 | 156 | 3.41 | 2 (1%) | -2.18 · -0.58 · 0.72 · 1.07 | 0 / 0 |
| real | 4h | 595 | 528 | 468 | 3.70 | 1 (0%) | -3.29 · -1.54 · -0.10 · 0.73 | 0 / 0 |
| controlo (baralhado) | 4h | 595 | 545 | 484 | 3.71 | 2 (0%) | -2.51 · -0.54 · 0.21 · 1.03 | 0 / 0 |
| controlo (blocos de 20: mantém dependência curta) | 4h | 595 | 549 | 486 | 3.71 | 1 (0%) | -2.36 · -0.91 · 0.31 · 0.88 | 0 / 0 |
| real | 1d | 520 | 389 | 332 | 3.61 | 3 (1%) | -2.28 · -0.79 · 0.30 · 0.65 | 0 / 0 |
| controlo (baralhado) | 1d | 520 | 409 | 349 | 3.63 | 1 (0%) | -2.20 · -0.64 · 0.47 · 1.11 | 0 / 0 |

Leitura: as linhas «controlo» usam as mesmas configurações e os mesmos portões em dados sem estrutura temporal. Se os dados reais não se distinguirem do controlo, não há vantagem detetável.

## 3. Candidatas e robustez

Candidatas que passam G1-G3 e G6 em dados reais: 0.

## 4. As 20 configurações com maior t agrupado (dev+val), passem ou não os portões

| velas | configuração | dev n / R | val n / R | t agrupado | positiva dev e val | queda | R bruto / custos |
|---|---|---|---|---|---|---|---|
| 1h | regime[thr=20]/E | 27 / +0.55 | 14 / +0.60 | 1.71 | sim | 6.6% | +0.74 / 0.17 |
| 1h | adx[thr=20]/A | 26 / +0.23 | 19 / +0.20 | 1.43 | sim | 3.3% | +0.36 / 0.14 |
| 1h | regime[thr=25]/E | 27 / +0.49 | 19 / +0.13 | 1.06 | sim | 9.6% | +0.52 / 0.17 |
| 1h | ml[hz=12,thr=0.6]/A | 36 / +0.04 | 27 / +0.19 | 0.80 | sim | 5.0% | +0.25 / 0.15 |
| 4h | ens[Ldays=120,th=4]/A | 88 / -0.02 | 37 / +0.25 | 0.73 | não | 7.0% | +0.21 / 0.15 |
| 4h | rsi[set=14/20/80,filt=0]/E | 29 / +0.19 | 16 / -0.06 | 0.71 | não | 5.7% | +0.23 / 0.13 |
| 1d | bbbrk[k=2.5,tr=1]/B | 37 / +0.10 | 15 / -0.07 | 0.65 | não | 1.8% | +0.15 / 0.10 |
| 1d | zmom[N=6,thr=2]/B | 35 / +0.01 | 22 / +0.11 | 0.62 | sim | 3.2% | +0.14 / 0.09 |
| 1h | regime[thr=30]/E | 31 / +0.19 | 20 / +0.09 | 0.52 | sim | 14.4% | +0.33 / 0.17 |
| 4h | ens[Ldays=120,th=3]/A | 119 / -0.04 | 37 / +0.25 | 0.41 | não | 7.5% | +0.18 / 0.15 |
| 1h | adx[thr=25]/A | 24 / +0.12 | 19 / -0.01 | 0.41 | não | 4.4% | +0.21 / 0.14 |
| 4h | zrev[N=12,thr=2.5]/E | 46 / +0.01 | 21 / +0.07 | 0.40 | sim | 4.0% | +0.15 / 0.12 |
| 1d | bbbrk[k=2.5,tr=1]/F | 35 / -0.03 | 15 / +0.16 | 0.33 | não | 4.4% | +0.14 / 0.11 |
| 1d | pbk[set=50/200]/E | 50 / +0.03 | 33 / +0.03 | 0.30 | sim | 8.3% | +0.12 / 0.09 |
| 1h | ml[hz=6,thr=0.55]/A | 40 / -0.02 | 28 / +0.11 | 0.27 | não | 7.6% | +0.18 / 0.15 |
| 4h | rsi[set=14/20/80,filt=0]/C | 29 / +0.06 | 16 / -0.01 | 0.25 | não | 5.8% | +0.17 / 0.13 |
| 1h | bbrev[k=2.5,filt=0]/C | 43 / +0.07 | 34 / -0.03 | 0.22 | não | 7.9% | +0.20 / 0.18 |
| 1d | zmom[N=12,thr=2]/B | 24 / +0.03 | 17 / -0.00 | 0.21 | não | 2.6% | +0.10 / 0.08 |
| 1d | bbbrk[k=2.5,tr=1]/A | 37 / +0.02 | 15 / +0.01 | 0.21 | sim | 2.9% | +0.13 / 0.11 |
| 1d | pbk[set=20/100]/C | 85 / +0.01 | 50 / -0.01 | 0.12 | não | 8.3% | +0.10 / 0.09 |

## 5. Resultado por família (todas as configurações elegíveis em dados reais)

| família | elegíveis | com R>0 em dev e val | melhor t agrupado | R médio agrupado (mediana das configs) |
|---|---|---|---|---|
| regime — Mudança de regime por ADX: tendência (EMA 20/50) ou reversão (Bollinger) | 36 | 3 | 1.71 | -0.18 |
| adx — ADX: tendência só quando há força | 42 | 1 | 1.43 | -0.17 |
| ml — Regressão logística em janela deslizante (8 variáveis), previsão do sinal de H velas | 40 | 1 | 0.80 | -0.14 |
| ens — Pontuação de sinais: EMA, momentum, MACD e RSI | 60 | 0 | 0.73 | -0.10 |
| rsi — RSI: reversão em extremos | 89 | 0 | 0.71 | -0.13 |
| bbbrk — Bandas de Bollinger: rompimento a favor da tendência | 48 | 1 | 0.65 | -0.18 |
| zmom — Continuação do retorno de N velas (z-score) | 43 | 1 | 0.62 | -0.24 |
| zrev — Reversão do retorno de N velas (z-score) | 43 | 1 | 0.40 | -0.11 |
| pbk — Pullback à média rápida dentro da tendência | 42 | 1 | 0.30 | -0.12 |
| bbrev — Bandas de Bollinger: reversão à média | 54 | 0 | 0.22 | -0.18 |
| vwap — VWAP diário ancorado às 00:00 UTC: reversão | 6 | 1 | 0.08 | -0.11 |
| mtf — Vários horizontes: tendência da escala maior e pullback na escala menor | 54 | 0 | -0.12 | -0.13 |
| emax — Cruzamento de médias móveis exponenciais | 60 | 0 | -0.14 | -0.19 |
| macd — MACD: cruzamento do histograma | 78 | 0 | -0.15 | -0.15 |
| long200 — Referência: só comprado acima da EMA longa (filtro de tendência) | 16 | 0 | -0.38 | -0.12 |
| imom — Momentum intradiário: movimento desde a abertura do dia continua até ao fecho | 39 | 0 | -0.39 | -0.17 |
| swing — Estrutura de máximos e mínimos (pivôs) e rompimento do último pivô | 23 | 0 | -0.46 | -0.16 |
| tsmom — Momentum de série temporal (sinal do retorno de L dias) | 40 | 0 | -0.50 | -0.15 |
| stoch — Estocástico: cruzamento em zona extrema | 27 | 0 | -0.52 | -0.14 |
| candle — Padrões de velas (engolfo e pin bar) com filtro de tendência | 60 | 0 | -0.54 | -0.17 |
| nr — Barra de intervalo estreito (NR4/NR7) e rompimento | 54 | 0 | -0.63 | -0.18 |
| don — Canal de Donchian (rompimento de N velas) | 99 | 0 | -0.63 | -0.20 |
| thrmom — Impulso de uma vela (k×ATR) a favor da tendência | 17 | 0 | -0.68 | -0.25 |
| brk_ema — Rompimento + tendência EMA (regra atual do bot) | 24 | 0 | -0.93 | -0.19 |
| fbo — Falsa rutura (varrimento de liquidez) e reversão | 27 | 0 | -1.10 | -0.19 |
| squeeze — Compressão de volatilidade (Bollinger dentro de Keltner) e libertação | 20 | 0 | -1.11 | -0.15 |
| asian — Rompimento do intervalo da sessão asiática (00-08 UTC) na abertura de Londres | 14 | 0 | -2.31 | -0.19 |
| thrfade — Compra da queda (k×ATR) a favor da tendência maior | 5 | 0 | -2.58 | -0.36 |
| orb — Rompimento do 1.º intervalo da sessão americana (13-14 UTC) | 2 | 0 | -4.79 | -0.17 |

## 6. Teste final (últimos 25%, tocado só para as finalistas)

**Nenhuma configuração passou todos os portões: nenhuma estratégia é aprovada e o teste final não foi usado.**

## 7. Métodos perigosos, só em ambiente isolado: martingale

Série: 145 trades reais (R) da regra atual do bot (brk_ema, brk 20, saída A), reamostrada (3 000 caminhos de 150 trades, risco inicial 1%). Martingale: dobra o risco após cada perda (teto 32%), volta a 1% após um ganho.

| dimensionamento | capital final (mediana) | pior 5% | queda máxima média | probabilidade de perder ≥50% |
|---|---|---|---|---|
| fixo 1% | 0.78× | 0.66× | 24.3% | 0.0% |
| martingale ×2 | 0.45× | 0.34× | 59.6% | 86.5% |

R médio da série: -0.16 por trade. O martingale não altera a expectativa por trade; só concentra o risco (queda máxima média e/ou probabilidade de ruína mais altas). Não é usado.

## 8. Contagens efetivas

- Famílias na biblioteca: 30; configurações distintas (família × parâmetros × saída × velas): 1655.
- Simulações executadas: 3905 (reais 1655, controlo 2250, robustez 0, teste final 0).
- Candidatas após G1-G3+G6: 0; finalistas após G4-G5: 0; confirmadas no teste final: 0.
- Tempo: 3.1 min com 4 processos.