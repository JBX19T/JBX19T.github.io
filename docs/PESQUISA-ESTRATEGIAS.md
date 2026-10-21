# Pesquisa de estratégias e metodologia — registo de fontes

Data: 2026-10-21. Este registo diz exatamente o que foi e o que não foi consultado. As fontes dão hipóteses e metodologia; **não** são prova de rentabilidade.

## 1. Contagens reais

| Item | Número |
|---|---|
| Pesquisas web feitas (ferramenta de pesquisa, só resumos) | 13 |
| Páginas abertas e lidas na íntegra | **0** (3 tentativas de abrir páginas falharam: o domínio não resolve a partir do ambiente) |
| Fontes distintas em que me apoiei (ver §2) | 28 |
| Das quais artigos, teses, revisões académicas ou documentação oficial | 16 |
| Das quais blogues, sites de backtests, fóruns e sínteses de fornecedores (evidência fraca, sem auditoria) | 12 |
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
