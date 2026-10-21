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
