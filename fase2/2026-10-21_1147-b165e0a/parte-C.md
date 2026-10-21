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
