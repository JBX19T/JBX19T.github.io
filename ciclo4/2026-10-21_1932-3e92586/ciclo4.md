# Ciclo 4 — colheita de funding (spot comprado + perpétuo vendido) — 2026-10-21T19:28:38.047Z

**Tudo o que segue é simulado com dados históricos; não são resultados reais.** Regras e critérios: `docs/PREREGISTO-CICLO4-CARRY.md` (escrito antes desta corrida).

## Dados

| mercado | spot (dias) | perpétuo (dias) | funding Binance (eventos) | funding Hyperliquid (eventos) | primeiro funding |
|---|---|---|---|---|---|
| BNB | 2607 | 2445 | 7274 | — | 2020-02-10 |
| ETH | 2607 | 2485 | 7395 | 21500 | 2020-01-01 |
| BTC | 2607 | 2485 | 7395 | 21500 | 2020-01-01 |
| SOL | 2262 | 2223 | 6700 | 21500 | 2020-09-13 |
| XRP | 2607 | 2475 | 7379 | — | 2020-01-06 |
| DOGE | 2607 | 2294 | 6821 | — | 2020-07-10 |
| ADA | 2607 | 2455 | 7339 | — | 2020-01-19 |
| LINK | 2607 | 2469 | 7346 | — | 2020-01-17 |
| LTC | 2607 | 2472 | 7370 | — | 2020-01-09 |
| AVAX | 2220 | 2219 | 6598 | — | 2020-09-22 |

Avaliação E1 (funding Binance): 2020-01-01 → 2026-10-20; DEV até 2023-05-27, VAL até 2025-02-06, TEST até ao fim. E2 (funding Hyperliquid): 2023-05-01 → 2026-10-20.

## Resultados da carteira (3 mercados, capital igual, retorno sobre o capital total)

| período / variante | dias | retorno anual (média × 365) | IC95 % | t | p unilateral | volatilidade anual | Sharpe | queda máx. | retorno acumulado |
|---|---|---|---|---|---|---|---|---|---|
| E1 completo | 2484 | 5.8% | [3.7%, 8.2%] | 4.98 | <0.001 | 1.0% | 5.82 | 0.9% | 48.1% |
| E1 DEV | 1242 | 8.5% | [4.8%, 12.9%] | 4.10 | <0.001 | 1.3% | 6.58 | 0.9% | 33.5% |
| E1 VAL | 621 | 5.8% | [3.4%, 8.7%] | 4.33 | <0.001 | 0.6% | 9.33 | 0.3% | 10.4% |
| **E1 TEST** | 621 | 0.3% | [-0.4%, 1.0%] | 0.75 | 0.225 | 0.3% | 0.89 | 0.4% | 0.5% |
| E1 TEST, custos ×2 | 621 | -1.4% | [-2.3%, -0.5%] | -3.03 | 0.999 | 0.5% | -2.51 | 2.3% | -2.3% |
| **E2 funding Hyperliquid** | 1268 | 7.6% | [4.4%, 11.1%] | 4.45 | <0.001 | 0.8% | 9.38 | 0.5% | 30.0% |
| E2, custos ×2 | 1268 | 6.1% | [3.0%, 9.6%] | 3.65 | <0.001 | 0.9% | 6.78 | 1.3% | 23.6% |
| Robustez: 10 mercados (E1 completo) | 2484 | 5.5% | [3.3%, 8.0%] | 4.49 | <0.001 | 0.9% | 5.85 | 1.1% | 44.9% |
| Referência: sempre ligado (E1 completo) | 2484 | 6.1% | [4.0%, 8.5%] | 5.23 | <0.001 | 1.0% | 6.33 | 1.2% | 51.2% |

### Por ano (E1, regra principal)

| ano | dias | retorno E1 | retorno E2 (Hyperliquid) |
|---|---|---|---|
| 2020 | 366 | 9.0% | — |
| 2021 | 365 | 21.4% | — |
| 2022 | 365 | -0.7% | — |
| 2023 | 365 | 3.5% | 6.6% |
| 2024 | 366 | 8.0% | 17.5% |
| 2025 | 365 | 0.6% | 3.8% |
| 2026 | 292 | 0.1% | 0.0% |

### De onde vem o resultado (por mercado, em % do nocional, soma no período; E1 completo)

| mercado | dias posicionado | entradas | saídas | reequilíbrios | liquidações | funding recebido | base (perp − spot) | custos |
|---|---|---|---|---|---|---|---|---|
| BTC | 1950 | 36 | 35 | 13 | 1 | 84.7% | 0.3% | -16.2% |
| ETH | 1982 | 36 | 33 | 20 | 3 | 100.1% | -0.2% | -20.4% |
| SOL | 1326 | 64 | 56 | 18 | 8 | 59.3% | 2.6% | -33.4% |

### E2 (funding Hyperliquid) por mercado

| mercado | dias posicionado | entradas | liquidações | funding recebido | base | custos |
|---|---|---|---|---|---|---|
| BTC | 807 | 11 | 0 | 48.2% | -0.1% | -5.3% |
| ETH | 781 | 19 | 0 | 44.6% | -0.2% | -8.1% |
| SOL | 685 | 23 | 1 | 49.2% | 0.4% | -10.6% |

## Sensibilidade aos limiares (E1 completo, só diagnóstico: a decisão usa a regra fixa 0,005 % / 0 %)

| entrar se média ≥ | sair se média < | retorno anual | Sharpe | queda máx. |
|---|---|---|---|---|
| 0.0000 % | -0.0050 % | 6.2% | 6.18 | 1.1% |
| 0.0000 % | 0.0000 % | 4.9% | 4.73 | 3.0% |
| 0.0025 % | -0.0050 % | 6.3% | 6.40 | 0.6% |
| 0.0025 % | 0.0000 % | 5.4% | 5.29 | 1.4% |
| 0.0025 % | 0.0025 % | 4.2% | 3.95 | 4.0% |
| 0.0050 % | -0.0050 % | 6.5% | 6.71 | 0.6% |
| 0.0050 % | 0.0000 % | 5.8% | 5.82 | 0.9% |
| 0.0050 % | 0.0025 % | 5.0% | 4.97 | 2.4% |
| 0.0100 % | -0.0050 % | 6.4% | 6.54 | 0.6% |
| 0.0100 % | 0.0000 % | 5.9% | 6.18 | 0.6% |
| 0.0100 % | 0.0025 % | 5.6% | 5.86 | 0.6% |

Para comparação (não é a mesma coisa): comprar e manter BTC no mesmo período deu 43.0% por ano composto, com queda máxima de 76.6%.

## Decisão (critérios do pré-registo)

| critério | valor | passa |
|---|---|---|
| a) TEST > 0, p corrigido (Holm, 48 hipóteses) < 0,05 | 0.3% por ano; p = 0.225 → corrigido 1.000 | não |
| b) TEST com custos ×2 > 0 | -1.4% | não |
| c) ≥ 2/3 dos anos positivos | 6/7 | sim |
| d) queda máxima ≤ 10 % | 0.9% | sim |
| e) E2 (funding Hyperliquid) > 0 com p < 0,05 | 7.6%; p = <0.001 | sim |
| f) nenhuma liquidação | 13 | não |
| g) 10 mercados > 0 | 5.5% | sim |

**Resultado do Ciclo 4: não aprovada.**

# Contagens efetivas

- Regra de decisão: 1 (mais 47 hipóteses anteriores no Holm). Diagnósticos: sempre ligado, 10 mercados, 11 combinações de limiares (não decidem).
- Tempo: 3.8 min.