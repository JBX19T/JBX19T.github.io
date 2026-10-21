# Pesquisa de estratégias e metodologia — registo de fontes

Data: 2026-10-21. Este registo diz exatamente o que foi e o que não foi consultado. As fontes dão hipóteses e metodologia; **não** são prova de rentabilidade.

## 1. Contagens reais

| Item | Número |
|---|---|
| Pesquisas web feitas (ferramenta de pesquisa, só resumos) | 21 (13 na 1.ª ronda, 8 na fase 2) |
| Páginas abertas e lidas na íntegra | **0** (3 tentativas de abrir páginas falharam: o domínio não resolve a partir do ambiente; na fase 2 não repeti, e usei só resumos de pesquisa) |
| Fontes distintas em que me apoiei (ver §2 e §2b) | 39 |
| Das quais artigos, teses, revisões académicas ou documentação oficial | 25 |
| Das quais blogues, sites de backtests, fóruns e sínteses de fornecedores (evidência fraca, sem auditoria) | 14 |
| Estratégias/famílias com regras formais implementadas na biblioteca | 29 (`grokbot/lab.js`) |
| Configurações distintas simuladas por tamanho de vela | 1h: 540 · 4h: 595 · 1d: 520 (total 1 655) |

**O que NÃO foi consultado** (não há acesso a partir deste ambiente, ou não é fonte de evidência): vídeos do YouTube, ideias e scripts do TradingView, código do MQL5 CodeBase e Expert Advisors do MT4/MT5, repositórios do GitHub de terceiros, livros. Onde uma ideia vem do conhecimento geral do autor e não de uma fonte consultada, a biblioteca marca a fonte como `G` (conhecimento geral) e não finge uma referência.

Limitação importante: como as pesquisas devolvem resumos e não o texto integral, os números que cito das fontes (por exemplo, alfa de 4,9 % ou Sharpe de 1,08) vêm de resumos secundários e **não estão verificados** contra os artigos originais. Servem para decidir *o que testar*, nunca como resultado.

## 2. Fontes consultadas (resumos de pesquisa)

### Evidência sobre tendência e momentum
| ID | Fonte | Link | O que retirei | Fiabilidade |
|---|---|---|---|---|
| S1 | Moskowitz, Ooi, Pedersen (2012), *Time Series Momentum*, J. Financial Economics | https://papers.ssrn.com/abstract=2089463 | regra: comprar quando o retorno dos últimos 12 meses é positivo, vender quando é negativo; 58 mercados | artigo académico (resumo) |
| S1b | Quantpedia, *Deconstructing the Time-Series Momentum Strategy* (resume Kim, Tse, Wald) | https://quantpedia.com/deconstructing-the-time-series-momentum-strategy/ | crítica: o alfa depende da escala por volatilidade (1,27 % → 0,41 % sem escala) e desaparece em 2009-2013 | resumo secundário |
| S1c | Alpha Architect, *Cross asset signals and time series momentum* | https://alphaarchitect.com/cross-asset-signals-and-time-series-momentum/ | contexto | blogue |
| S2 | Hurst, Ooi, Pedersen (2017), *A Century of Evidence on Trend Following Investing*, JPM | https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing | 67 mercados, 1880-2016; retornos positivos e baixa correlação com ativos tradicionais | artigo (resumo); autores gestores de fundos de tendência |
| S10a | StrategyQuant, *From the turtles to today* | https://strategyquant.com/blog/from-the-turtles-to-today-how-a-40-year-old-strategy-still-works/ | regras Turtle: Donchian 20/10 e 55/20 + stop e dimensionamento por volatilidade | blogue de fornecedor |
| S10b | LuxAlgo, *Donchian trend rules* | https://www.luxalgo.com/library/concept/donchian-trend-rules.md | confirma as regras | fornecedor |
| S10c | Universidade do Cabo, tese sobre canais de Donchian (futuros sul-africanos) | https://open.uct.ac.za/handle/11427/21754 | teste de rompimento de preços | tese de mestrado |

### Evidência crítica sobre análise técnica
| ID | Fonte | Link | O que retirei |
|---|---|---|---|
| S3a | Park e Irwin, revisão da rentabilidade da análise técnica | https://farmdoc.illinois.edu/publications/the-profitability-of-technical-analysis-a-review | 58 de 92 estudos modernos positivos, mas com viés de seleção de regras e de custos |
| S3b | Park e Irwin, working paper 2004 | https://ageconsearch.umn.edu/record/37487/files/AgMAS04_04.pdf | corrigidos os vieses de «data snooping», só 2 de 17 contratos de futuros mostram lucro significativo |
| S4 | Neely, Weller, Ulrich (2009), *The Adaptive Markets Hypothesis: Evidence from the FX Market* | https://files.stlouisfed.org/files/htdocs/wp/2006/2006-046.pdf | regras simples de médias móveis e filtros deixaram de dar lucro em câmbio no início dos anos 90 |
| S5a | Leung e Chong, Bandas de Bollinger vs envelopes de médias | https://www.aof.org.hk/uploads/conference_detail/952/con_paper_0_72_3_chong_bollinger1.pdf | Bollinger não supera os envelopes |
| S5b | Fang, Jacobsen, Qin, *Popularity versus Profitability* | https://www.tias.edu/en/item/popularity-versus-profitability | rompimento de bandas funcionou antes de meados dos anos 80, não desde então |
| S5c | Lento, Gradojevic, Wright (2007) | https://ideas.repec.org/a/taf/raflxx/v3y2007i4p263-267.html | depois de custos, Bollinger não bate comprar e manter; melhora com abordagem contrária (reversão) |

### Reversão, intradiário e sessões
| ID | Fonte | Link | O que retirei | Fiabilidade |
|---|---|---|---|---|
| S6a | Backtrex, Connors RSI(2) no Nasdaq 100 | https://backtrex.com/en/backtests/connors-rsi-2-nasdaq-100 | 75 % de acerto mas perdas maiores que ganhos por construção; não bateu comprar e manter | site comercial, sem auditoria |
| S6b | ProRealCode, RSI-2 de Larry Connors | https://prorealcode.com/prorealtime-trading-strategies/rsi-2-strategy-larry-connors | regras; resultados pobres em 1 e 15 minutos | fórum |
| S6c | Steemit, resumo das alegações de Connors | https://steemit.com/fmz/@fmz.com/larry-connors-rsi2-mean-reversion-strategy | RSI<5 melhor que RSI<10 | secundário |
| S7a | Gao, Han, Li, Zhou (2018), *Market intraday momentum*, JFE | https://profiles.wustl.edu/en/publications/market-intraday-momentum/ | o retorno da 1.ª meia hora prevê o da última | artigo (resumo) |
| S7b | CXO Advisory, replicação | https://www.cxoadvisory.com/?p=25481 | R² de 0,014 a 0,02; avisa de «data snooping» e de fricções | blogue de síntese |
| S8a | Backtrex, rompimento de Londres no EUR/USD | https://backtrex.com/en/backtests/london-breakout-eur-usd | acerto de 36 %, sem vantagem na forma básica | site comercial |
| S8b | MQL5, *London Breakout on Gold: 3.7 years of backtests* | https://www.mql5.com/en/blogs/post/777540 | filtros de amplitude do intervalo e stops curtos pesaram; amostra de 157 trades | blogue pessoal |
| S8c | MQL5, *Why the same strategy wins in London and dies in Tokyo* | https://www.mql5.com/en/blogs/post/774527 | «abertura de Londres» muda com o horário de verão: dividir por sessão | blogue |
| S9a | Moreira e Muir, *Volatility-Managed Portfolios* | https://www.nber.org/papers/w22208.pdf | reduzir exposição com volatilidade alta aumenta o Sharpe (resultado sobre fatores de ações) | working paper (resumo) |
| S9b | Replicação norueguesa | https://biopen.bi.no/bi-xmlui/handle/11250/2624951 | resultados semelhantes; réplica americana (tese) mais fraca e difícil de implementar | tese |

### Metodologia contra sobreajuste
| ID | Fonte | Link | O que retirei |
|---|---|---|---|
| M1a | Bailey e López de Prado, *The Deflated Sharpe Ratio* | https://papers.ssrn.com/abstract=2460551 | corrigir o Sharpe pelo número de tentativas e pela não-normalidade |
| M1b | Bailey, Borwein, López de Prado, Zhu, *The Probability of Backtest Overfitting* | https://papers.ssrn.com/abstract=2326253 | probabilidade de o melhor «in-sample» ficar abaixo da mediana «out-of-sample» |
| M2 | Harvey, Liu, Zhu, *… and the Cross-Section of Expected Returns* (NBER 20592) | https://www.nber.org/papers/w20592 | com testes múltiplos o limiar de t deve ser acima de 3,0, não 2,0 |

### Custos de execução
| ID | Fonte | Link | O que retirei |
|---|---|---|---|
| H1 | Documentação da Hyperliquid, HIP-3 (resumo de pesquisa) | https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals | nos mercados lançados por terceiros as taxas para o utilizador são o **dobro** das dos mercados normais; quem lança pode acrescentar taxas; existe um «modo de crescimento» com taxas mais baixas |
| H1b | FalconX, *Transformational Potential of HIP-3* | https://www.falconx.io/newsroom/the-transformational-potential-of-hyperliquids-hip-3 | contexto; volume do mercado XYZ100 |

**Consequência para o modelo de custos:** se a taxa normal de um perpétuo é cerca de 4,5 bps (valor de uma fonte secundária), o dobro dá os 9 bps que o bot assume. É coerente, mas a taxa exata dos mercados `xyz:` **continua por confirmar** (a pesquisa não a devolveu). A auditoria mostra que as conclusões não dependem desta taxa: sem custos o resultado também não é positivo (ver `docs/AUDITORIA-DADOS-REAIS.md`).

## 2b. Fontes acrescentadas na fase 2 (resumos de pesquisa)

| ID | Fonte | Link | O que retirei | Fiabilidade |
|---|---|---|---|---|
| S11 | Zarattini, Aziz, Barbon (2024-25), *Beat the Market: An Effective Intraday Momentum Strategy for S&P500 ETF (SPY)*, SFI Research Paper 24-97 | https://www.sfi.ch/de/publications/n-24-97-beat-the-market-an-effective-intraday-momentum-strategy-for-s-p500-etf-spy | regra de momentum intradiário no SPY com stops móveis; reporta 19,6 % anual e Sharpe 1,33 líquidos de custos (2007-2024) | working paper; números dos autores, não replicados aqui |
| S12 | Zarattini, Pagani, Wilcox (2025), *Does Trend-Following Still Work on Stocks?* | https://concretumgroup.com/does-trend-following-still-work-on-stocks/ | revê a tendência em ações dos EUA 1950-2024 | praticantes (Concretum); só resumo |
| S13 | Faber (2007), *A Quantitative Approach to Tactical Asset Allocation* (resumos) | https://www.fedsmith.com/2010/07/28/asset-allocation-your-tsp/ | regra: dentro/fora de cada classe de ativos conforme o preço está acima/abaixo da média simples de 10 meses | resumo secundário |
| S14 | Sullivan, Timmermann, White (1999), *Data-snooping, technical trading rule performance, and the bootstrap*, J. Finance | https://researchonline.lse.ac.uk/id/eprint/119144 | aplica o Reality Check de White a um universo grande de regras técnicas | artigo; as leituras dos resultados são **contraditórias** entre resumos (ver abaixo) |
| S14b | Bajgrowicz, Scaillet, EFMA 2008 | https://www.efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2008-Athens/papers/Bajgrowicz.pdf | revisão posterior | artigo (resumo) |
| S15 | White (2000), *A Reality Check for Data Snooping*, Econometrica | https://www.econometricsociety.org/publications/econometrica/2000/09/01/reality-check-data-snooping | teste de que o melhor modelo de uma busca não bate a referência; bootstrap estacionário | artigo (resumo) |
| S15b | Documentação do pacote `arch`: teste SPA de Hansen | https://arch.readthedocs.io/en/latest/multiple-comparison/generated/arch.bootstrap.SPA.html | SPA padroniza por desvio-padrão e usa blocos geométricos (bootstrap estacionário) | documentação de software |
| S16 | Lempérière, Deremble, Seager, Potters, Bouchaud, *Two centuries of trend following* | https://ar5iv.arxiv.org/html/1404.3274 | Sharpe ≈ 0,7 num conjunto diversificado desde 1800, t ≈ 5 desde 1960; números **brutos de custos** | working paper (resumo) |
| S16b | Lempérière et al., *Trends and Risk Premia: Update* | https://arxiv.org/pdf/1708.07637 | tendências longas sem degradação estatística, tendências curtas «enfraqueceram» | working paper (resumo) |
| S17 | Brock, Lakonishok, LeBaron (1992), J. Finance | https://ideas.repec.org/a/bla/jfinan/v47y1992i5p1731-64.html | médias móveis e rompimentos no Dow Jones 1897-1986 favoráveis; retestes posteriores mistos | artigo (resumo) |
| S18 | Baltas e Kosowski, *Demystifying Time-Series Momentum Strategies* | https://papers.ssrn.com/abstract=2140091 | modelo de custos para futuros; menos rotação sem perda significativa | working paper (resumo) |

**O que a fase 2 aprendeu com estas fontes:**
- A literatura boa sobre tendência (S1, S2, S16) é de **portefólios diversificados de futuros em dezenas de mercados e décadas**, **sem custos** nos números principais (S16) ou com custos pequenos de futuros (S18). A hipótese H1-H4 testa uma versão de **um mercado de cada vez, a 9 bps por ordem**, que é bem mais exigente.
- S14 é um aviso concreto sobre leituras contraditórias: um resumo diz que as regras sobreviveram ao *data snooping*, outro diz que nenhuma foi significativa. Sem ler o artigo, não decido entre as duas leituras.
- S11 é o único resultado «intradiário» recente com custos incluídos, mas é do próprio autor, em ETF de ações dos EUA e com stops móveis; não foi replicado aqui (o bot não tem SPY).

## 3. O que as fontes dizem, em conjunto
1. A evidência mais forte (S1, S2) é de **tendência lenta, diversificada por muitos mercados**, com meses de horizonte. Não é rompimento de 15 minutos.
2. As revisões críticas (S3, S4, S5) mostram que regras simples de análise técnica **perdem vantagem com o tempo e com a correção de custos e de «data snooping»**.
3. A evidência de reversão curta (RSI-2) e de sessões (rompimento de Londres) vem de sites e blogues sem auditoria; o único teste estruturado no EUR/USD que encontrei foi negativo na forma básica.
4. Para testar muitas ideias com honestidade é preciso corrigir testes múltiplos (M1, M2): é o que o laboratório faz (`docs/LABORATORIO.md`).

## 4. Catálogo: ideias, implementação e razões

Legenda: ✔ implementada em `grokbot/lab.js` · ✘ não implementada (razão).

### A. Price action e estrutura
| Ideia | Estado | Id na biblioteca | Fonte |
|---|---|---|---|
| Rompimento de máximos/mínimos (Donchian) | ✔ | `don`, `brk_ema` | S10 |
| Rompimento + reteste / pullback | ✔ (pullback à média) | `pbk` | G |
| Consolidação e expansão de volatilidade | ✔ | `squeeze`, `nr` | G |
| Padrões de velas (engolfo, pin bar) | ✔ | `candle` | G |
| Estrutura de máximos e mínimos | ✔ | `swing` | G |
| Liquidez e falsas ruturas | ✔ | `fbo` | G |
| Suporte e resistência por zonas | ✘ | — | sem definição objetiva e reproduzível; os pivôs (`swing`) são a versão objetiva |

### B. Indicadores
Médias móveis e cruzamentos ✔ `emax`; RSI ✔ `rsi`; MACD ✔ `macd`; ATR ✔ (usado em stops e filtros); Bandas de Bollinger ✔ `bbrev`, `bbbrk`; VWAP ✔ `vwap` (VWAP diário ancorado às 00:00 UTC, com o volume dos dados; em PAXG o volume é de um proxy); ADX ✔ `adx`; Estocástico ✔ `stoch`; volume e momentum ✔ (`tsmom`, `zmom`, `thrmom`).

### C. Quantitativas
Momentum / tendência ✔ `tsmom`, `zmom`, `long200`; reversão à média ✔ `zrev`, `rsi`, `bbrev`; filtros de volatilidade e tendência ✔ (parâmetros `filt`, `tr`); sistemas de pontuação de sinais ✔ `ens`; modelos de previsão com validação ✔ `ml` (ver E). **Arbitragem estatística ✘**: precisa de pares ou cestos com dados de custo de contrapartida; o universo do bot tem 3 mercados sem relação de cointegração demonstrada. **Modelos de séries temporais (ARIMA, GARCH) ✘**: a vantagem esperada sobre a regressão logística é pequena e o risco de sobreajuste, grande.

### D. Sessões e contexto
Sessão asiática/europeia/americana ✔ `asian`, `orb`; abertura de mercados ✔ `orb`; momentum intradiário ✔ `imom` (S7); swing e intradiário ✔ nos tamanhos de vela 1h/4h/1d; regimes ✔ `regime`. Nota de S8c: o horário de verão desloca as sessões; o laboratório usa horas UTC fixas e **não** corrige isso (limitação).

### E. Avançadas
Vários horizontes ✔ `mtf`; sistemas adaptativos / deteção de regimes ✔ `regime`; ensembles ✔ `ens`; **machine learning ✔ `ml`**: regressão logística treinada em janela deslizante só com dados passados (8 variáveis de preço), que prevê o sinal do retorno de 6 ou 12 velas. Justificação: é o modelo mais simples com validação temporal estrita; modelos maiores (árvores, redes) não se justificam com poucas dezenas de milhares de velas e relação sinal-ruído próxima de zero. Otimização de portefólios de estratégias ✘ (só faz sentido depois de existir pelo menos uma estratégia aprovada).

### F. Gestão de posição
Stop-loss em ATR ✔; take-profit fixo ✔ (saídas A, B, F); stop móvel ✔ (C); break-even ✔ (F, novo em `strategy.js`, desligado por omissão); saídas por tempo ✔ (`maxHoldBars`); saída por sinal contrário ✔ (E, novo no motor); dimensionamento por risco ✔ (1 % da conta, limite de alavancagem). **Saídas parciais ✘**: o motor trata uma posição inteira de cada vez; implementar parciais exige dividir posições e rever custos. Não vou fingir que foram testadas.

### Métodos perigosos
Martingale: simulado **só** em ambiente isolado sobre a série de R do próprio bot (secção 7 do relatório do laboratório); não entra na biblioteca. Grid sem controlo de exposição e aumento progressivo de posições perdedoras: ✘ não implementados (o martingale demonstra o mesmo risco).

## 5. Limitações desta pesquisa
- 13 pesquisas e nenhuma página lida na íntegra: a profundidade é baixa face ao que o pedido descrevia.
- Não vi vídeos nem scripts de terceiros; nada foi copiado, por isso não há questões de licença.
- 12 das 28 fontes são blogues, sites de backtests ou fóruns, com evidência fraca; as outras 16 são académicas ou oficiais, mas lidas só em resumo.
- Várias famílias têm origem no conhecimento geral e não numa fonte consultada (marcadas `G`).
