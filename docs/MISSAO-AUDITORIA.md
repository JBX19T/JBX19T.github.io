# Missão «estratégia original» — auditoria do trabalho feito e plano de investigação

Data: 2026-10-21. Base: Fase 1 (3 905 simulações) e Fase 2 (~7 100), `docs/LABORATORIO-FASE2.md`.

## 1. O que falhou e porquê (evidência, não opinião)

| # | Falha | Evidência | O que implica |
|---|---|---|---|
| F1 | **Custo > sinal.** Cada trade paga 0,11–0,15 R de custos; o melhor sinal bruto encontrado vale +0,08 a +0,10 R (1h, `ml`/`rsi`). | Parte A4/A7 | A vantagem tem de ser medida **em bps por trade, contra o custo**, e o sistema só deve operar quando o movimento esperado excede o custo por uma margem. As regras anteriores operavam sempre que o padrão aparecia. |
| F2 | **Pouco poder estatístico.** 2 mercados (ouro, EUR/USD) × 2,5 anos; vantagem mínima detetável +0,26 a +0,44 R. | Parte A6 | Resultados nulos eram inconclusivos. Para detetar vantagens de 10–30 bps é preciso **muitos ativos e muitos anos**. |
| F3 | **Mesma informação, mesmas famílias.** 29 famílias, mas todas lêem o OHLCV do próprio ativo e todas com saídas fixas; só 322 conjuntos de entrada distintos. | Parte A1 | Variar parâmetros não acrescenta hipóteses. Falta informação nova (outros ativos, regime de mercado, posição relativa). |
| F4 | **Regras fixas, sem abstenção.** Nenhuma regra decidia *não* operar com base no custo/vol esperados, exceto o filtro de ATR mínimo. | Parte B3 (perde em baixa volatilidade e em saídas ≤ 2 velas) | O ganho potencial está em **quando não operar**. |
| F5 | **A direção quase não é previsível, a volatilidade é.** Entrada do rompimento = entrada aleatória (p > 0,1). | Parte B1 | Explorar a volatilidade (dimensionar e filtrar) em vez de adivinhar direção. |
| F6 | **Dados curtos nos instrumentos negociados** (Binance PAXG/EURUSDT desde 2020; Hyperliquid ~200 dias em 1h) e taxa `xyz:` por confirmar. | Parte A, sondagens | Procurar vantagens em universos com mais história e depois transferir. |
| F7 | O que sobreviveu à crítica são **deriva de mercado** (S&P longo, BTC/ETH), não habilidade. | Partes C, E | Qualquer candidato tem de ser avaliado contra comprar-e-manter e em mercado neutro. |

## 2. O que ainda não foi explorado

| Id | Oportunidade | Porquê pode dar informação nova | Estado |
|---|---|---|---|
| O1 | **Previsão conjunta em muitos ativos com limiar de custo** (modelo linear regularizado, walk-forward, opera só se movimento previsto ≥ k × custo) | ~40 ativos × 7 anos dá ~100× mais amostra; usa informação cruzada (posição relativa, regime do BTC) | **Ciclo 1 (em curso)** |
| O2 | **Funding, open interest e posicionamento da Hyperliquid** como preditores | Dados que as estratégias OHLCV não vêem | Ciclo 2 (depende de histórico longo na API) |
| O3 | **Volatilidade**: dimensionar por vol prevista e operar só em regimes de vol em expansão | A vol é previsível; ajuda a cobrir o custo | Ciclo 2 |
| O4 | **Execução**: entradas maker (1,5 bps vs 4,5 bps) | Reduz o custo, mas tem seleção adversa; só medível com fills reais/demo | Depende de demo |
| O5 | **Sazonalidade intradiária do ouro** (Londres/NY) | Já testada em parte na Fase 1 (sem resultado); dados de 1h só ~2 anos | Baixa prioridade |
| O6 | **Desk de memecoins (Solana)** | Dados históricos limitados, risco de liquidez e rug | Fora do âmbito até haver dados |

## 3. Regras do jogo desta missão

- Os critérios de aceitação ficam **escritos antes** de ver resultados (`docs/PREREGISTO-CICLO1.md`) e não mudam.
- Teste final (último 25 % do tempo) só é aberto para finalistas pré-definidos, uma vez.
- Nenhuma ordem real, `HL_LIVE`/`SOL_LIVE`/`HL_AUTOPILOT` desligados, sem martingale, proteções do bot intactas.
- «Validada» ≠ lucrativa no futuro. Resultado simulado nunca é apresentado como lucro real.
