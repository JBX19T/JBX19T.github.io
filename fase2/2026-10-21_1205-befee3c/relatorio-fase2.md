# Fase 2 — relatório de investigação — 2026-10-21T12:04:39.477Z

## Dados

| conjunto | barras por mercado | período | fim do desenvolvimento | fim da validação | impressão digital |
|---|---|---|---|---|---|
| real:1h | GOLD 29999, EURUSD 29999 | 2023-05-20 → 2026-10-21 | 2025-02-03 | 2025-12-13 | 29999:2023-05-20:2026-10-21:c0e43347 · 29999:2023-05-20:2026-10-21:4b30bb07 |
| real:4h | GOLD 13470, EURUSD 14898 | 2020-01-03 → 2026-10-21 | 2023-05-29 | 2025-02-07 | 13470:2020-08-28:2026-10-21:eccee99d · 14898:2020-01-03:2026-10-21:5c6d4049 |
| real:1d | GOLD 2245, EURUSD 2483 | 2020-01-03 → 2026-10-20 | 2023-05-28 | 2025-02-07 | 2245:2020-08-28:2026-10-20:a66db71f · 2483:2020-01-03:2026-10-20:1546028f |
| ind:GSPC | GSPC 14322 | 1970-01-02 → 2026-10-20 | — | — | 1 · 4 · 3 · 2 · 2 · : · 1 · 9 · 7 · 0 · - · 0 · 1 · - · 0 · 2 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 0 · : · b · 5 · a · a · c · f · 9 · 1 |
| ind:GLD | GLD 3971 | 2004-11-18 → 2020-08-27 | — | — | 3 · 9 · 7 · 1 · : · 2 · 0 · 0 · 4 · - · 1 · 1 · - · 1 · 8 · : · 2 · 0 · 2 · 0 · - · 0 · 8 · - · 2 · 7 · : · f · 6 · 2 · 8 · 0 · c · a · 8 |
| ind:EURUSD | EURUSD 4168 | 2003-12-01 → 2019-12-31 | — | — | 4 · 1 · 6 · 8 · : · 2 · 0 · 0 · 3 · - · 1 · 2 · - · 0 · 1 · : · 2 · 0 · 1 · 9 · - · 1 · 2 · - · 3 · 1 · : · 6 · 6 · d · f · 1 · 5 · 7 · c |
| ind:JPY | JPY 7773 | 1996-10-30 → 2026-10-21 | — | — | 7 · 7 · 7 · 3 · : · 1 · 9 · 9 · 6 · - · 1 · 0 · - · 3 · 0 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · e · b · 8 · f · 1 · 9 · 9 · 2 |
| ind:TLT | TLT 6096 | 2002-07-30 → 2026-10-20 | — | — | 6 · 0 · 9 · 6 · : · 2 · 0 · 0 · 2 · - · 0 · 7 · - · 3 · 0 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 0 · : · b · f · b · 3 · 2 · b · 5 · d |
| ind:BTC | BTC 4418 | 2014-09-17 → 2026-10-21 | — | — | 4 · 4 · 1 · 8 · : · 2 · 0 · 1 · 4 · - · 0 · 9 · - · 1 · 7 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · 8 · 4 · f · 1 · a · f · 6 · 5 |
| ind:ETH | ETH 3269 | 2017-11-09 → 2026-10-21 | — | — | 3 · 2 · 6 · 9 · : · 2 · 0 · 1 · 7 · - · 1 · 1 · - · 0 · 9 · : · 2 · 0 · 2 · 6 · - · 1 · 0 · - · 2 · 1 · : · e · 0 · 8 · b · 4 · b · b · 6 |


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


# Contagens efetivas

- Simulações executadas nesta corrida: 32.
- Tempo: 0.5 min com 4 processos.