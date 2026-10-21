# Laboratório de estratégias e relatório final da investigação

Data: 2026-10-21. Resultados completos: `docs/LABORATORIO-RESULTADOS.md` (relatório) e branch `lab-results` (todas as experiências, `experimentos.jsonl.gz`). Fontes: `docs/PESQUISA-ESTRATEGIAS.md`. Diagnóstico das perdas: `docs/AUDITORIA.md` §1-13 e `docs/AUDITORIA-DADOS-REAIS.md`.

## Resposta curta

**Nenhuma estratégia foi aprovada.** Foram simuladas 1 655 configurações de 29 famílias (3 905 simulações com os controlos). Nenhuma passou os portões estatísticos e os dados reais **não se distinguem dos dados de controlo sem estrutura temporal**: o melhor t agrupado em dados reais foi 1,71 (1h), 0,73 (4h) e 0,65 (1d), contra 1,07, 1,03 e 1,11 nos controlos; o limiar para aprovar era 3,4 a 3,7. O teste final (últimos 25 %) **não foi usado**, porque não houve finalistas.

Isto significa «não encontrei vantagem nesta biblioteca, com estes dados e com estes custos». Não significa «é impossível». Ver as limitações (§7), em particular o poder estatístico.

## 1. Estado das fases pedidas

| Fase | Estado | Onde |
|---|---|---|
| 0. Auditoria do bot existente | **feita** (sessões anteriores e esta) | `AUDITORIA.md`, `AUDITORIA-DADOS-REAIS.md` |
| 1. Varredura de fontes | **feita, com limites**: 13 pesquisas, 28 fontes lidas em resumo, 0 páginas lidas na íntegra; sem YouTube, TradingView, MQL5 CodeBase nem GitHub de terceiros (sem acesso) | `PESQUISA-ESTRATEGIAS.md` |
| 2. Biblioteca de estratégias | **feita**: 29 famílias com id, fontes, grelha de parâmetros e regras formais; deteção de duplicados por correlação | `grokbot/lab.js`, `grokbot/labstats.js` |
| 3. Laboratório autónomo | **feito**: executor paralelo com limites, registo de todas as experiências, reprodutível | `scripts/lab-run.mjs`, `.github/workflows/lab.yml` |
| 4. Qualidade dos dados e simulação realista | **parcial**: dados verificados (ordem, duplicados, lacunas, velas inválidas), custos com taxa, slippage e funding (só Hyperliquid), entrada na abertura seguinte; **sem** bid/ask nem profundidade; **sem** tamanho mínimo de ordem | `AUDITORIA-DADOS-REAIS.md` §0 |
| 5. Protocolo de backtesting | **feito**: desenvolvimento 50 % / validação 25 % / teste final 25 %, métricas pedidas (ver §4) | `scripts/lab-run.mjs` |
| 6. Prevenção de sobreajuste | **feita**: testes múltiplos (Bonferroni e Benjamini-Hochberg sobre o nº efetivo de hipóteses), estabilidade de parâmetros, custos ×1,5, controlo negativo, teste final reservado | §3 |
| 7. Seleção automática | **feita**: portões fixados antes de ver resultados; resultado: nenhuma aprovada | §3 |
| 8. Teste do bot como sistema | **já coberto** pelos testes existentes (guarda, execução, risco, reinício, ordens duplicadas, aprovação no servidor; 15 ficheiros de testes); **não repetido** para estratégias novas porque nenhuma foi aprovada | `worker/test/` |
| 9. Paper trading prolongado | **não aplicável ainda**: não há estratégia candidata; protocolo definido em §6 | §6 |
| 10. Autonomia controlada | **definida e implementada em parte**: o laboratório corre por pedido e em cada alteração das regras, nunca promove nada sozinho | §6 |
| 11. Relatório final | este documento | |

## 2. A. Diagnóstico (resumo; detalhe em AUDITORIA.md)

- O bot original perdia porque **não tem vantagem bruta** e os custos (0,09 a 0,18 R por trade) são maiores do que o pouco que as regras ganham antes de custos. Não havia um bug único: foram corrigidos 19 problemas de fidelidade e segurança (§1 da auditoria).
- O Rompimento de 15 min não negociava porque o filtro de custo recusava 99 % das velas (ATR de 0,12 % contra 0,60 % exigidos).
- Day trade e Swing 4h são indistinguíveis de zero em 303 dias da Hyperliquid; no histórico longo o Day trade é negativo com significância (t = −3,76).
- Limitações ainda por resolver: taxa real dos mercados `xyz:` por confirmar; tamanho mínimo de ordem com $10 reais; funding só em parte das horas.

## 3. B e C. Investigação e resultados

### Protocolo (fixado antes de ver resultados; está no cabeçalho de `scripts/lab-run.mjs`)
1. Dados de cada tamanho de vela divididos no tempo: desenvolvimento 50 %, validação 25 %, teste final 25 %.
2. Fase A: todas as configurações são simuladas **só até ao fim da validação**. O código não calcula nada do teste final para quem não for finalista.
3. Portões: G1 ≥ 40 trades (dev + val); G2 R médio > 0 no desenvolvimento **e** na validação; G3 t agrupado acima do limiar de testes múltiplos: **camada A** = Bonferroni (α = 5 % unilateral) sobre o nº efetivo de hipóteses, **camada B** = Benjamini-Hochberg com 10 % de falsas descobertas; G4 com custos ×1,5 o R médio agrupado continua > 0; G5 pelo menos 2/3 das configurações vizinhas (um parâmetro ao lado) com R médio > 0; G6 queda máxima < 20 %.
4. O nº efetivo de hipóteses conta grupos de configurações com resultados diários correlacionados ≥ 0,9 (variantes quase idênticas valem uma).
5. Teste final só para finalistas; confirmação = R médio > 0 com ≥ 20 trades.
6. Controlo negativo: as mesmas configurações e os mesmos portões em dados baralhados (sem estrutura temporal), para medir quantas «descobertas» o acaso produz. O executor foi validado também com um controlo positivo (tendência plantada em dados sintéticos: `worker/test/lab_runner.test.mjs`).

### Números reais
| Item | Valor |
|---|---|
| Fontes (resumos) / pesquisas | 28 / 13 |
| Famílias implementadas | 29 (mais 6 ideias não implementadas, com a razão em `PESQUISA-ESTRATEGIAS.md`: zonas de suporte/resistência, arbitragem estatística, ARIMA/GARCH, otimização de portefólios, saídas parciais, grid) |
| Configurações distintas | 1 655 (1h: 540 · 4h: 595 · 1d: 520) |
| Simulações executadas | 3 905 (reais 1 655, controlo 2 250, robustez 0, teste final 0) |
| Elegíveis (≥ 40 trades) | 1h: 245 · 4h: 528 · 1d: 389 |
| Grupos efetivos de hipóteses | 220 · 468 · 332 |
| Limiar t de Bonferroni | 3,51 · 3,70 · 3,61 |
| Positivas em desenvolvimento **e** validação | 6 · 1 · 3 (2 %, 0 %, 1 %); nos controlos 2 · 2 · 1 |
| Passam todos os portões | **0** |

### Comparação com a versão original
A regra atual do bot (`brk_ema`, 24 configurações elegíveis) tem R médio mediano de −0,19 e melhor t de −0,93. Nenhuma família teve R médio mediano positivo (de −0,10 em `ens` a −0,36 em `thrfade`). As melhores configurações têm R **bruto** de +0,10 a +0,74 mas custos de 0,08 a 0,18 R; com 14 a 119 trades por segmento, nenhuma é distinguível do acaso.

### As seis configurações do 1h positivas em desenvolvimento e validação (as mais «atrativas»)
Cinco delas aparecem entre as 20 melhores (`regime[thr=20]/E` com t 1,71, `adx[thr=20]/A` 1,43, `regime[thr=25]/E`, `ml[hz=12,thr=0.6]/A`, `regime[thr=30]/E`); a sexta não está na lista das 20. Com 14 a 36 trades por segmento e 220 grupos de hipóteses em teste, e com o controlo a produzir 2 casos iguais em 183 configurações, são o que o acaso produz. Não são candidatas.

### Estratégias rejeitadas e razões
Todas as 29 famílias foram rejeitadas por não passarem G3 (nenhuma distingue-se do controlo). Famílias com piores resultados: `orb` (t −4,79), `thrfade` (−2,58), `asian` (−2,31), `squeeze`, `fbo`, `brk_ema`, `don` (os rompimentos). A família com mais configurações positivas em dev e val foi `regime` (3 de 36), sem significância.
Métodos perigosos: o **martingale** (isolado, sobre a série real de 145 trades do bot) piora tudo: capital final mediano 0,45× contra 0,78× com risco fixo, queda máxima média 59,6 % contra 24,3 %, e **86,5 % de probabilidade de perder metade da conta** contra 0 %. Não é usado.

### Walk-forward e estabilidade temporal
A divisão em três partes cronológicas é o walk-forward do laboratório (escolher em desenvolvimento, confirmar em validação). Como nenhuma configuração passou, não há resultados fora da amostra a reportar; o teste final continua intacto para uma próxima candidata.

### Métricas disponíveis
Por configuração o laboratório regista: n de trades, taxa de acerto, lucro líquido, fator de lucro, R médio e R bruto/custos, drawdown máximo, Sharpe, Sortino, Calmar, fator de recuperação, dias debaixo de água, exposição, distribuição por segmento e t agrupado (`experimentos.jsonl.gz`). Os intervalos de confiança por blocos e a distribuição por mercado, sessão, regime e mês estão em `AUDITORIA-DADOS-REAIS.md` para as estratégias auditadas e são calculados no laboratório para as finalistas (não houve).

## 4. D. Estratégias selecionadas

**Nenhuma.** Nada foi escolhido e nada foi alterado na produção.

## 5. E. Arquitetura

Sem alterações de comportamento na produção. O que existe:
- **App e Macro Desk** (`grokbot/`): regras em `strategy.js`, motor de teste em `backtest.js`, interface de teste histórico com o diagnóstico por vela.
- **Worker** (`worker/`): guarda de risco, piloto automático, aprovação no servidor, registo de execução, paragem de emergência, ntfy. Valores de `HL_LIVE`, `SOL_LIVE` e `HL_AUTOPILOT` inalterados.
- **Laboratório** (`grokbot/lab.js`, `labstats.js`, `scripts/lab-run.mjs`): separado da produção; só lê dados públicos; nunca envia ordens.
- Alterações pequenas a `strategy.js` e `backtest.js` por causa do laboratório, **desligadas por omissão** (`beATR`, saída por sinal, exposição, `perf`). Os 15 ficheiros de testes passam.
- Segurança: um módulo de IA não pode alterar limites de risco; o laboratório não toca em configuração de produção. A passagem para dinheiro real exige aprovação por estratégia, no servidor, e decisão humana explícita.
- Rollback: o código original está no histórico do git; os resultados do laboratório ficam versionados na branch `lab-results`.

## 6. F. Plano de implementação e melhoria contínua

### Ficheiros criados ou alterados nesta investigação
`grokbot/lab.js`, `grokbot/labstats.js`, `scripts/lab-run.mjs`, `.github/workflows/lab.yml`, `grokbot/backtest.js` (gancho `signalAt`, saída por sinal, exposição, `perf`, diagnóstico, estatísticas), `grokbot/strategy.js` (break-even desligado por omissão), `worker/test/lab.test.mjs`, `worker/test/lab_runner.test.mjs`, `worker/test/quant.test.mjs`, `docs/PESQUISA-ESTRATEGIAS.md`, `docs/LABORATORIO.md`, `docs/LABORATORIO-RESULTADOS.md`.

### Como correr
- No GitHub: Actions → «Laboratório de estratégias» → *Run workflow* (corre também a cada alteração dos ficheiros do laboratório). Demora cerca de 3 minutos com 4 processos.
- Localmente: `node scripts/lab-run.mjs --out lab-out` (precisa de acesso à Binance). Teste de fumo sem rede: `node scripts/lab-run.mjs --synthetic --small --ivs 4h --out /tmp/lab`.
- Testes: `cd worker && node --test`.

### Ciclo de melhoria contínua (definido; sem promoção automática)
1. Recolher dados novos (o laboratório descarrega-os a cada corrida).
2. Voltar a correr as 1 655 configurações e o controlo; comparar com a corrida anterior (a branch `lab-results` guarda cada uma).
3. Se uma configuração passar os portões, o laboratório calcula o teste final **uma vez**, mais a generalização em cripto (BTC, ETH) e nos dados recentes da Hyperliquid.
4. Se for confirmada, **propõe-se** (relatório) a implementação em `strategy.js` com teste de paridade; as regras do laboratório usam indicadores pré-calculados sobre toda a série e a produção usa janela de 200 velas (a paridade foi medida em `brk_ema`: 0 diferenças em 1 500 velas).
5. Passa a **paper trading** (Macro Desk) com protocolo fixado antes: pelo menos 90 dias **e** pelo menos 30 trades; compara sinais, preços, slippage observado e R líquido com o backtest; se o desempenho se deteriorar, volta à fase 2.
6. Só depois, com **autorização humana explícita**, se pode considerar uma exposição real pequena (o limite de $10 e a trava de aprovação por estratégia mantêm-se).
- Nunca substitui automaticamente uma estratégia de produção por outra que teve melhores resultados recentes; nunca aumenta o risco; o teste final de cada configuração só pode ser consumido uma vez (se for usado para decidir, passa a dados de desenvolvimento e é preciso reservar um novo).

## 7. Limitações e o que falta

1. **Poder estatístico baixo para vantagens modestas.** Com 220 a 468 grupos de hipóteses o limiar é t ≈ 3,5 a 3,7. Com uns 125 trades e desvio de 1,2 R por trade, só se detetaria uma vantagem de cerca de **0,4 R por trade** (valor ilustrativo: 3,7 × 1,2 ÷ √125); para detetar +0,15 R seriam precisos cerca de 800 trades por configuração. Uma vantagem verdadeira mas pequena **não seria encontrada**. Ausência de prova não é prova de ausência.
2. **Proxies:** ouro = PAXG e EUR/USD = EURUSDT (Binance spot), com custos supostos iguais aos da Hyperliquid (9 bps por ordem a mercado, por confirmar). O S&P 500 não está no histórico longo. O 1h só tem 3,4 anos (limite de 30 000 velas).
3. **Só 2 mercados** no universo de seleção; cripto e Hyperliquid só se usam para finalistas (não houve).
4. **Fontes:** só resumos de pesquisa, sem páginas lidas na íntegra; nada de vídeos, TradingView, MQL5 nem repositórios de terceiros.
5. **Não implementado:** saídas parciais, arbitragem estatística, ARIMA/GARCH, otimização de portefólio, correção do horário de verão nas sessões, bid/ask, tamanho mínimo e passo das ordens, notícias.
6. **Machine learning:** apenas regressão logística em janela deslizante; modelos maiores não se justificam com este volume de dados e sinal-ruído.
7. **Controlo negativo:** o baralhado destrói também o agrupamento de volatilidade; o de blocos de 20 mantém dependência curta e não deu descobertas.
8. **O melhor resultado da corrida foi escolhido depois de ver todos:** nada disto é uma recomendação.

## 8. Testes adicionais necessários antes de qualquer implementação
- Confirmar a taxa taker/maker real dos mercados `xyz:` e o slippage real (testnet/conta demo com ordens pequenas; o worker já regista).
- Repetir o laboratório quando houver mais histórico (os mercados `xyz:` existem desde dezembro de 2025) e com mais instrumentos, **com hipóteses fixadas antes**.
- Fazer o mesmo com dados de bid/ask se a Hyperliquid os disponibilizar, e modelar o tamanho mínimo de ordem.
- Só então: paper trading prolongado (§6).

## 9. Estado das estratégias
Todas as 29 famílias: **não validadas** (sem vantagem distinguível do controlo). Nenhuma pronta para conta demo de execução nem para dinheiro real. O bot continua a ser uma ferramenta de **simulação e estudo**.
