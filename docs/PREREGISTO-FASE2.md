# Pré-registo da Fase 2 (hipóteses e regras de decisão fixadas ANTES de correr)

Escrito em 2026-10-21, antes de qualquer corrida em dados novos. O histórico git mostra que este ficheiro foi enviado antes dos resultados. Se alguma regra mudar depois, a mudança tem de aparecer num novo commit com a razão, e o resultado antigo mantém-se no relatório.

## 0. Princípios
- Os critérios estatísticos **não** são reduzidos para aprovar algo. Qualquer alteração aos limiares abaixo só pode torná-los mais exigentes.
- Nada é escolhido pelo melhor resultado: cada hipótese é uma regra completa, definida aqui.
- O teste final (últimos 25 % dos dados da Binance) mantém-se intocado. Exceção já conhecida e declarada: no relatório da auditoria (`AUDITORIA-DADOS-REAIS.md`, §7) o Swing diário nesse período já foi visto (+0,75 R, 24 trades). Esse período **não conta** como evidência independente.
- «Independente» significa: mercados e períodos que nunca foram usados para escolher nem para ver resultados de nenhuma estratégia do bot.

## 1. Hipóteses de tendência em dados independentes (Parte C)

**Dados (Yahoo Finance, barras diárias, OHLC, preços brutos):**

| Série | Período usado | Nota de independência |
|---|---|---|
| ^GSPC (S&P 500) | 1970-01 → hoje | nunca testado |
| GLD (ETF de ouro) | 2004-11 → 2020-08-27 | termina antes de o PAXG existir (o PAXG foi usado no laboratório) |
| EURUSD=X | 2003-12 → 2019-12-31 | termina antes de o EURUSDT existir |
| JPY=X | 1996-10 → hoje | nunca testado |
| TLT (obrigações longas dos EUA) | 2002-07 → hoje | nunca testado |
| BTC-USD | 2014-09 → hoje | nunca testado |
| ETH-USD | 2017-11 → hoje | nunca testado |

Limpeza fixada: linhas com algum OHLC nulo são removidas; se `high < max(open, close)` ou `low > min(open, close)`, corrige-se `high`/`low` para o extremo (acontece no câmbio do Yahoo). Sem a limpeza não há resultado.

**Regras (iguais às da biblioteca `grokbot/lab.js`; nenhuma pode ser ajustada):**

| Id | Estratégia | Configuração |
|---|---|---|
| H1 | Swing diário de produção (compra e venda) | `swing`: rompimento de 20 velas + EMA 20/50, stop 2×ATR, stop móvel 3×ATR, máx. 60 velas (`brk_ema[brk=20]/S`) |
| H2 | Canal de Donchian longo | `don[N=55,tr=1]/C`: rompimento de 55 velas a favor de EMA 20/50, stop 3×ATR, stop móvel 3×ATR, máx. 20 dias |
| H3 | Momentum de série temporal | `tsmom[Ldays=120]/C`: sinal do retorno de 120 velas (com o de 30 velas), stop 3×ATR, stop móvel 3×ATR |
| H4 | Referência «comprado acima da EMA 200» | `long200[N=200]/E`: só compra acima da EMA 200, sai por sinal contrário |

Cada série é simulada em separado (conta de $10 000, risco 1 % por trade, alavancagem máxima 5×, uma série de cada vez). **Custos base: 9 bps por ordem a mercado, slippage 3 bps (stop 5 bps)**, iguais aos do bot, mesmo sendo conservadores para índices e câmbio.

**Estatística:** média do R por trade juntando todas as séries independentes de cada hipótese. O erro-padrão vem de *bootstrap por blocos de calendário* (blocos = meses, séries juntas, 5 000 reamostragens), que respeita a dependência no tempo e entre mercados. Teste unilateral (só interessa expectativa positiva).

**Regra de decisão (todas têm de se verificar para «aprovada para paper trading»):**
1. t ≥ 1,645 depois da correção de Holm para as 4 hipóteses (α global 5 %, unilateral);
2. pelo menos 2/3 das séries com ≥ 10 trades têm R médio > 0;
3. com custos ×2 (18 bps) o R médio agrupado continua > 0;
4. retirando as 3 melhores trades, o R médio agrupado continua > 0;
5. queda máxima de cada série ≤ 25 %;
6. resultado igual no 1.º e no 2.º metade do tempo de cada série com mais de 20 trades (média > 0 nas duas metades em pelo menos 2/3 das séries).

**Classificação:** «aprovada para paper» (todas as condições); «inconclusiva» (média > 0 mas alguma condição falha, ou IC a incluir zero); «rejeitada» (média ≤ 0 ou IC superior a 95 % abaixo de +0,05 R). Uma estratégia nunca passa a dinheiro real por esta via: só a paper trading (§4).

**Poder:** com desvio de 1,3 R por trade e meta de detetar +0,15 R a t = 1,645 (unilateral), precisa-se de cerca de **250 trades agrupados**. Se uma hipótese tiver menos trades do que isso, o resultado será «inconclusivo» por falta de poder, e declara-se.

## 2. Diagnóstico do rompimento (Parte B), em dados da Binance até ao fim da validação

Referência: `brkx` com os parâmetros da regra atual (N=20, EMA 20/50, sem outros filtros, saída A) em ouro e EUR/USD (PAXG, EURUSDT), 4h, 1h e 1d, **só dados de desenvolvimento e validação** (até 2025-02-07 em 4h e 1d; até 2025-12-12 em 1h).

1. **Teste da entrada, independente de saídas e custos:** em cada sinal (sem sobreposição: um sinal por janela de 48 velas), mede-se o retorno futuro em unidades de R (stop = 2×ATR) após 1, 2, 4, 6, 12, 24 e 48 velas, e a relação MFE/MAE (E-ratio de Sweeney). Compara-se com **entradas aleatórias** (mesmo número de sinais, instantes e direções ao acaso, 5 000 sorteios). Hipótese: a entrada tem vantagem se o retorno futuro for maior do que o das entradas aleatórias; unilateral, Holm sobre os 7 horizontes.
2. **Experiências controladas, um fator de cada vez**, relativamente à referência:
   - confirmação de rompimento: fecho além do nível por 0,25 / 0,5 / 1 ATR;
   - rompimento já esticado (rejeitar se a vela fecha a mais de 1 / 2 ATR do nível);
   - filtro de tendência: sem filtro; EMA 10/30; EMA 50/200;
   - força da tendência: ADX ≥ 20 / 25 / 30 (lateralização);
   - volatilidade: ATR% acima da mediana; ATR% baixo (compressão); vela de expansão (amplitude ≥ 1,5 ATR);
   - volume: volume ≥ 1,5× a média de 20 velas (só se existir volume fiável);
   - sessão: só 07-15 UTC; só 13-21 UTC; sem 00-07 UTC (só 1h e 4h);
   - momentum: ROC(10) concorda; RSI(14) > 55 / < 45;
   - reteste do nível (entrada no regresso ao nível, até 6 velas depois);
   - tamanho do rompimento: N = 10 / 40 / 55;
   - stop/alvo: saídas A (2/3), B (2/1,5), C (3, stop móvel), E (3, saída por sinal), F (2/3 com break-even);
   - execução: ordens limitadas (maker).
3. **Decisão por experiência:** diferença emparelhada entre o resultado diário da variante e o da referência (mesmos dados), com *bootstrap estacionário* (blocos médios de 20 dias, 5 000 reamostragens); p unilateral; correção de **Holm** sobre todas as experiências do mesmo tamanho de vela. Uma mudança «melhora realmente» só se Holm-p < 0,05 **e** a diferença for positiva no desenvolvimento e na validação separados.

## 3. Auditoria das 1 655 experiências (Parte A)
Sem hipóteses a confirmar: análise descritiva (estratégias distintas, decomposição bruto/custos, por ativo, vela e período, poder estatístico), verificação do cálculo do t e do limiar, *White Reality Check* sobre as séries diárias de todas as configurações elegíveis (bootstrap estacionário) e uma corrida **sem custos** de todas as configurações para medir se existe previsibilidade bruta.

## 4. Passagem a paper trading (se alguma hipótese for «aprovada para paper»)
- Duração mínima de 90 dias **e** pelo menos 30 trades no Macro Desk (papel), com a mesma configuração, sem alterações.
- Comparar sinais, preços de entrada, slippage medido e R líquido com o backtest. Se o R líquido ficar abaixo de zero com intervalo de confiança a excluir o valor do backtest, volta à investigação.
- Dinheiro real só com decisão humana explícita; o limite de $10 e a trava de aprovação mantêm-se.

## 5. Limitações já conhecidas antes de correr
- O Yahoo Finance é uma fonte não oficial e pode ter erros de OHLC (câmbio) ou ajustes; sem alternativa acessível (o Stooq está bloqueado, a FRED só tem fecho).
- ETFs, índices e câmbio têm custos reais diferentes dos 9 bps da Hyperliquid. Por isso há sensibilidade 3 / 9 / 18 bps.
- Comprar o índice S&P 500 tem uma tendência de fundo positiva; um R médio positivo em compras pode vir dessa deriva e não de «timing». As estatísticas separam compras e vendas.
