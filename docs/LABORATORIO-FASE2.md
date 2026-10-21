# Laboratório — Fase 2: relatório final

Data: 2026-10-21. Resultados completos (tabelas por parte): `docs/LABORATORIO-FASE2-RESULTADOS.md`. Hipóteses e regras de decisão fixadas **antes** de cada corrida: `docs/PREREGISTO-FASE2.md` (+ Adendas 1 e 2). Fontes consultadas: `docs/PESQUISA-ESTRATEGIAS.md`.

## Conclusão em uma frase

**Nenhuma estratégia passou os critérios.** Não há evidência de vantagem estatística líquida de custos, robusta, para justificar dinheiro real. Não se baixou nenhum critério para aprovar nada.

## Os 12 pontos pedidos

### 1. Diagnóstico do bot atual
O rompimento atual (máx/mín de 20 velas + EMA 20/50, stop 2×ATR, alvo 3×ATR) é **significativamente negativo** fora do universo usado para o criar: 2 314 trades em 7 séries independentes, R médio **−0,10** (IC95 % [−0,13; −0,08]). Nos mercados do bot, a entrada **não** é melhor do que entradas aleatórias (Parte B1). Os custos pesam ≈ 0,11–0,15 R por trade; o resultado bruto é ligeiramente negativo (−0,02 a −0,04 R). Perdem sobretudo: vendas, EUR/USD, saídas por stop em ≤ 2 velas, baixa volatilidade.

### 2. Auditoria das 1 655 experiências
- 29 famílias; as 1 655 configurações correspondem a **322 conjuntos de sinais de entrada realmente distintos** (o resto varia só a saída). Duplicados exatos: `brk_ema` = `don` para N = 20 e 40.
- Para testes múltiplos contam os **grupos efetivos** (210/459/282 em 1h/4h/1d), não as configurações.
- O t e o limiar 3,4–3,7 estão corretos (t do código = cálculo independente; limiar = Bonferroni sobre grupos efetivos). O t ingénuo **não** sobrestima a significância (razão de erros-padrão 0,88–0,96), logo o limiar não era excessivo.
- Reality Check/SPA sobre todas as configurações: sem nada significativo em 4h e 1d; em dados baralhados (controlo) também nada. O melhor t real (1,71) é compatível com sorte.
- Poder: o laboratório só deteta vantagens grandes (mínima detetável +0,26 a +0,44 R). **Um resultado nulo é inconclusivo para vantagens pequenas.**
- Decomposição das perdas (R por trade): bruto −0,02 a −0,04, taxas −0,08 a −0,12, slippage −0,03 a −0,05, líquido −0,13 a −0,21.

### 3. Estratégias novas investigadas
29 famílias (reversão, tendência, momentum, Donchian, volatilidade, sazonalidade, ML simples, etc.) × 5 saídas, mais 6 hipóteses pré-registadas (H1–H6) e 4 condicionais ao custo (H7–H10). Ver `PESQUISA-ESTRATEGIAS.md` (21 pesquisas, 39 fontes) para as regras externas.

### 4. Números reais
- Fase 1: 3 905 simulações. Fase 2: ~7 100 simulações em dados reais (+ amostras de controlo).
- 1 655 configurações (540 em 1h, 595 em 4h, 520 em 1d), 322 conjuntos de entrada distintos.
- Hipóteses pré-registadas testadas em dados independentes: 10 (H1–H10).

### 5. Resultados brutos vs líquidos
Sem custos há previsibilidade mínima só em 1h (Reality Check p = 0,008; melhor R bruto +0,08 a +0,10 por trade em `ml`/`rsi`), mas **muito abaixo do custo** (0,12–0,17 R/trade). Em 4h e 1d, o bruto não se distingue do ruído.

### 6. Comparação com controlos
Dados baralhados dão t máx. ≤ 1,2 (4h/1d) e 2,6 (1h, sem custos). O rompimento atual não bate entradas aleatórias (p > 0,1 na maioria dos horizontes; só ouro 4h a 1 vela p ≈ 0,03, não sobrevive a Holm).

### 7. Fora da amostra / dados independentes
Parte C (S&P 500 desde 1970, ouro GLD, EUR/USD até 2019, USD/JPY, TLT, BTC, ETH) com custos de 9 bps, risco 1 %, Holm sobre 4 hipóteses:

| id | trades | R médio | IC95 % | p Holm | classificação |
|---|---|---|---|---|---|
| H1 Swing diário | 972 | +0,05 | [−0,05; +0,16] | 0,655 | inconclusiva |
| H2 Donchian 55 | 901 | +0,02 | [−0,04; +0,09] | 0,814 | inconclusiva |
| H3 TSMOM 120 | 1 157 | +0,00 | [−0,06; +0,06] | 0,983 | inconclusiva |
| H4 Long > EMA200 | 648 | −0,01 | [−0,07; +0,06] | 0,983 | rejeitada |
| REF rompimento atual | 2 314 | −0,10 | [−0,13; −0,08] | — | significativamente negativa |

Parte D (H5 expansão −0,03, H6 volume −0,05): **rejeitadas**. Os «melhoramentos» do rompimento encontrados na Parte B não sobreviveram a dados independentes.

**Swing diário (pedido específico):** em ouro+EUR/USD da Binance (dados já usados) +0,17 R, n = 88, IC95 % [−0,17; +0,55], t = 0,90; ouro +0,26 (n = 55), EUR/USD +0,01. Em dados independentes: +0,05 R, t = 0,99. 18 de 27 combinações de parâmetros vizinhas são positivas (sensibilidade moderada). **Não pode ser declarado lucrativo.**

### 8. Aprovadas / rejeitadas / inconclusivas
- **Aprovadas: nenhuma.**
- Inconclusivas: H1, H2, H3, H7, H8, H9, H10.
- Rejeitadas: H4, H5, H6; rompimento atual (REF).

**Parte E (H7–H10, custos de «modo de crescimento» ≈ 0,9 bps, só S&P 500 e EUR/USD):** H7 +0,02 R, H8 +0,03, H9 +0,02, todas t < 1. **H10 (só comprado acima da EMA 200): +0,09 R, IC95 % [+0,01; +0,17], t = 2,07, p Holm = 0,056** — não passa (t corrigido, uma só série positiva, nenhuma das duas metades consistentes). Todo o ganho vem do S&P 500 (+0,14 R; EUR/USD −0,08), que é uma série com forte deriva positiva; com taxa de 9 bps desce para +0,04. EUR/USD perde com todas as regras. É o candidato mais próximo, mas a conclusão correta é **inconclusiva**: depende de uma taxa que não está confirmada e de uma única série.

### 9. Limitações
- Taxa efetiva dos mercados `xyz:` **não confirmada** (padrão Hyperliquid: taker 4,5 bps, maker 1,5 bps; o dex xyz aplica escala 1,0; EUR e SP500 têm «growth mode», GOLD não). Medir com fills reais.
- Poder baixo para vantagens pequenas (mínima detetável +0,26 a +0,44 R por configuração).
- Preços de índice/ETF do Yahoo não são os preços dos perpétuos `xyz:`; slippage e profundidade reais não medidos.
- Binance/Hyperliquid com apenas ~2,5 anos (2020→hoje); o resto vem do Yahoo (limpeza documentada: linhas inválidas removidas, high/low corrigidos).
- BTC/ETH positivos por tendências enormes; não generalizável.
- A Parte D e a Parte E são exploratórias (derivam de resultados vistos); estão declaradas nas Adendas 1 e 2.
- Sem dados de book/ordens, sem funding, sem dados tick; M1 não foi testado.

### 10. Alterações ao código
`grokbot/lab.js` (família diagnóstica `brkx`, saída S, `configs` com opções), `grokbot/labstats.js` (Holm, Reality Check/SPA, bootstrap por clusters/emparelhado, entry-edge, decluster), `grokbot/backtest.js` e `strategy.js` (sinal de saída, exposição, `perf`, `diag`, break-even `beATR`), `scripts/lab2*.mjs` + `scripts/lib/*` (orquestrador paralelo, dados, tarefas), workflows `lab2.yml` e `probe.yml`. **Nada de produção mudou**: filtros de custo, `HL_LIVE`, `SOL_LIVE` e `HL_AUTOPILOT` ficam como estavam.

### 11. Testes
16 ficheiros de teste do worker passam, incluindo `lab.test.mjs` (sem lookahead), `lab2.test.mjs` (partes A–E ponta a ponta, 10 hipóteses classificadas, 27 combinações de sensibilidade) e testes de calibração estatística (falsos positivos ~ nível nominal; vantagem plantada detetada).

### 12. Plano de validação (paper trading, só para candidatos que passem)
Hoje **nenhuma** estratégia qualifica. O caminho para o candidato mais próximo (H10, só comprado acima da EMA 200 em S&P 500):
1. Confirmar a taxa efetiva em `xyz:SP500` com uma ordem mínima (ou `/hl/fills` do worker).
2. Se ≤ 3 bps: paper trading de 90 dias, sem alterar parâmetros, critério: R médio > 0 com IC95 % inferior > −0,05 e ≥ 30 trades, em duas metades.
3. Só então ponderar capital real com tamanho mínimo; stop global e proteções atuais mantêm-se.
4. Se a taxa for ≥ 9 bps: encerrar, ver o item 8 (+0,04 R, inconclusiva).

## Sobre «estratégias» do tipo vídeo (M1, volume crescente)
Descrição sem regra de entrada, e o aumento de volume é martingala/promediação em perda. Não é testável nem aceitável em produção; pode simular-se de forma isolada se houver regras exatas (ver conversa).
