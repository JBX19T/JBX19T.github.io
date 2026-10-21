# Fase 2 — relatório de investigação — 2026-10-21T11:56:02.725Z

## Dados

| conjunto | barras por mercado | período | fim do desenvolvimento | fim da validação | impressão digital |
|---|---|---|---|---|---|
| real:1h | GOLD 29999, EURUSD 29999 | 2023-05-20 → 2026-10-21 | 2025-02-03 | 2025-12-12 | 29999:2023-05-20:2026-10-21:9ad26d97 · 29999:2023-05-20:2026-10-21:4bbfea3 |
| real:4h | GOLD 13469, EURUSD 14897 | 2020-01-03 → 2026-10-21 | 2023-05-28 | 2025-02-07 | 13469:2020-08-28:2026-10-21:c32acedf · 14897:2020-01-03:2026-10-21:44a477ff |
| real:1d | GOLD 2245, EURUSD 2483 | 2020-01-03 → 2026-10-20 | 2023-05-28 | 2025-02-07 | 2245:2020-08-28:2026-10-20:a66db71f · 2483:2020-01-03:2026-10-20:1546028f |
| ind:GSPC | GSPC 14322 | 1970-01-02 → 2026-10-20 | — | — | 1 · 4 · 3 · 2 · 2 · : · 1 · 9 · 7 · 0 · - · 0 · 1 · - · 0 · 2 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 0 · : · b · 5 · a · a · c · f · 9 · 1 |
| ind:GLD | GLD 3971 | 2004-11-18 → 2020-08-27 | — | — | 3 · 9 · 7 · 1 · : · 2 · 0 · 0 · 4 · - · 1 · 1 · - · 1 · 8 · : · 2 · 0 · 2 · 0 · - · 0 · 8 · - · 2 · 7 · : · f · 6 · 2 · 8 · 0 · c · a · 8 |
| ind:EURUSD | EURUSD 4168 | 2003-12-01 → 2019-12-31 | — | — | 4 · 1 · 6 · 8 · : · 2 · 0 · 0 · 3 · - · 1 · 2 · - · 0 · 1 · : · 2 · 0 · 1 · 9 · - · 1 · 2 · - · 3 · 1 · : · 6 · 6 · d · f · 1 · 5 · 7 · c |
| ind:JPY | JPY 7773 | 1996-10-30 → 2026-10-21 | — | — | 7 · 7 · 7 · 3 · : · 1 · 9 · 9 · 6 · - · 1 · 0 · - · 3 · 0 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · 4 · 8 · 4 · 1 · 8 · d · 6 · 6 |
| ind:TLT | TLT 6096 | 2002-07-30 → 2026-10-20 | — | — | 6 · 0 · 9 · 6 · : · 2 · 0 · 0 · 2 · - · 0 · 7 · - · 3 · 0 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 0 · : · b · f · b · 3 · 2 · b · 5 · d |
| ind:BTC | BTC 4418 | 2014-09-17 → 2026-10-21 | — | — | 4 · 4 · 1 · 8 · : · 2 · 0 · 1 · 4 · - · 0 · 9 · - · 1 · 7 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · 7 · 4 · b · 8 · b · e · 2 · 6 |
| ind:ETH | ETH 3269 | 2017-11-09 → 2026-10-21 | — | — | 3 · 2 · 6 · 9 · : · 2 · 0 · 1 · 7 · - · 1 · 1 · - · 0 · 9 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · a · c · 0 · c · 4 · 1 · 8 · e |


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


# Contagens efetivas

- Simulações executadas nesta corrida: 63.
- Tempo: 0.5 min com 4 processos.