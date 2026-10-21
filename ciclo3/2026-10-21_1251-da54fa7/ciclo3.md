# Ciclo 3 — carteira neutra ao mercado — 2026-10-21T12:44:34.436Z

41 moedas (ignoradas: EUR: sem funding (0 eventos); sem funding fora); grelha de 1 h até 2026-10-21; quintis de 20 %; mínimo de 20 moedas por coorte; custo 2 × 12 bps + funding líquido; avaliação desde 2020-01-01; DEV/VAL/TEST = 50/25/25 %.

## Etapa 1 — previsibilidade transversal fora da amostra (DEV+VAL; diagnóstico)

| modelo | linhas | correlação OOS ŷ–y transversal | idem controlo | coortes (k=0) | spread bruto médio (bps) | perna comprada / vendida vs média (bps) | líquido médio [IC95 %] | t | controlo: spread bruto |
|---|---|---|---|---|---|---|---|---|---|
| 1h h=6 | 2167016 | 0.0137 | 0.0034 | 7044 | +9.1 | +4.6 / -4.5 | -15.0 [-18.5, -10.8] | -7.54 | +2.7 (líquido t -16.88) |
| 1h h=24 | 2166983 | 0.0176 | 0.0073 | 1763 | +6.6 | +0.5 / -6.1 | -17.4 [-26.5, -7.8] | -3.71 | +6.2 (líquido t -4.10) |
| 4h h=6 | 525639 | 0.0219 | 0.0037 | 1672 | +15.4 | +6.3 / -9.1 | -8.8 [-18.6, +1.6] | -1.70 | +2.1 (líquido t -5.69) |
| 1d h=5 | 73733 | 0.0164 | 0.0084 | 250 | +46.6 | +23.3 / -23.3 | +23.8 [-37.9, +79.9] | 0.80 | +12.5 (líquido t -0.31) |
| 1d h=10 | 73722 | 0.0268 | 0.0204 | 126 | +54.1 | +17.8 / -36.3 | +31.6 [-76.6, +132.7] | 0.60 | +81.8 (líquido t 0.87) |

Referência: custo de uma coorte = 2 × 12 = 24 bps (+ funding líquido). A perna comprada deve ficar acima da média e a vendida abaixo.

## Etapa 2 — configurações em DEV e VAL (custo 24 bps por coorte + funding)

| configuração | DEV: coortes · líquido bps · t | VAL: coortes · líquido bps · t | DEV+VAL: líquido [IC95 %] | bruto | p unilateral | p Holm (47) | finalista |
|---|---|---|---|---|---|---|---|
| 1h h=6, k=0 | 4558 · -13.1 · t -4.43 | 2486 · -18.4 · t -10.44 | -15.0 [-18.5, -10.8] | +9.1 | 1.000 | 1.000 | não |
| 1h h=6, k=1 | 204 · +41.3 · t 2.64 | — | +41.3 [-1.2, +59.8] | +65.3 | 0.028 | 1.000 | não |
| 1h h=6, k=2 | 10 · +40.0 · t 2.90 | — | +40.0 [+2.0, +58.2] | +64.8 | <0.001 | <0.001 | não |
| 1h h=24, k=0 | 1141 · -13.0 · t -1.98 | 622 · -25.6 · t -4.84 | -17.4 [-26.5, -7.7] | +6.6 | 1.000 | 1.000 | não |
| 1h h=24, k=1 | 683 · -7.4 · t -0.83 | 29 · -4.1 · t -0.07 | -7.3 [-25.3, +10.4] | +16.7 | 0.797 | 1.000 | não |
| 1h h=24, k=2 | 263 · -24.5 · t -1.12 | 1 · -110.6 · t — | -24.9 [-71.9, +12.2] | -1.4 | 0.901 | 1.000 | não |
| 4h h=6, k=0 | 1051 · -5.6 · t -0.81 | 621 · -14.2 · t -1.70 | -8.8 [-18.6, +1.7] | +15.4 | 0.951 | 1.000 | não |
| 4h h=6, k=1 | 660 · +2.6 · t 0.28 | 56 · +2.3 · t 0.04 | +2.6 [-17.1, +21.6] | +26.2 | 0.399 | 1.000 | não |
| 4h h=6, k=2 | 313 · -2.5 · t -0.15 | — | -2.5 [-36.3, +29.7] | +20.1 | 0.558 | 1.000 | não |
| 1d h=5, k=0 | 126 · +27.0 · t 0.58 | 124 · +20.4 · t 0.53 | +23.8 [-36.7, +78.9] | +46.6 | 0.207 | 1.000 | não |
| 1d h=5, k=1 | 99 · +21.2 · t 0.37 | 70 · +38.0 · t 0.67 | +28.1 [-55.9, +106.0] | +50.2 | 0.241 | 1.000 | não |
| 1d h=5, k=2 | 52 · +27.4 · t 0.37 | 19 · +16.5 · t 0.07 | +24.5 [-151.6, +153.7] | +45.2 | 0.361 | 1.000 | não |
| 1d h=10, k=0 | 64 · +6.2 · t 0.08 | 62 · +57.9 · t 0.85 | +31.6 [-75.1, +130.3] | +54.1 | 0.270 | 1.000 | não |
| 1d h=10, k=1 | 62 · -3.8 · t -0.05 | 60 · +44.7 · t 0.66 | +20.1 [-85.5, +115.7] | +42.7 | 0.348 | 1.000 | não |
| 1d h=10, k=2 | 52 · -30.5 · t -0.34 | 41 · +44.1 · t 0.50 | +2.4 [-127.4, +125.6] | +21.9 | 0.485 | 1.000 | não |

## Etapa 3 — teste final (abre-se uma vez, só para finalistas)

**Nenhuma configuração é finalista: o TEST não foi aberto.** Resultado do Ciclo 3: **negativo** (ver as razões na Etapa 2).

# Contagens efetivas

- Modelos treinados: 10; configurações de decisão: 15 (+ 32 de ciclos anteriores no Holm); finalistas: 0.
- Tempo: 6.7 min.