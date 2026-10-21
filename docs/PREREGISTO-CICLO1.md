# Pré-registo — Ciclo 1: previsão conjunta com limiar de custo (O1)

Escrito **antes** de qualquer corrida com dados reais. Execução: `node scripts/research/edgemap.mjs`.

## 1. Pergunta
Existe, num universo amplo de ativos líquidos, um padrão **fora da amostra e líquido de custos** que um modelo simples consiga prever, de modo que operar só quando o movimento previsto excede o custo seja rentável?

## 2. Dados
- Binance spot (USDT), velas de 1 h desde 2019-01-01 até hoje, ~40 moedas líquidas fixadas na lista do código (`UNIVERSE`) mais PAXG (ouro) e EURUSDT. Velas de 4 h e 1 d são agregadas das de 1 h (limites UTC). Moedas sem dados são ignoradas e listadas.
- **Limitações assumidas:** (a) universo escolhido hoje → viés de sobrevivência (favorece posições compradas; por isso reportam-se compras e vendas separadas); (b) preços spot Binance como substituto de perpétuos Hyperliquid; (c) funding e profundidade do book ignorados; (d) pouca representação de ouro/EUR (2 de ~40).

## 3. Modelo (fixo, sem ajustes depois de ver resultados)
- Alvo: `y = ln(open[t+1+h] / open[t+1]) / (σ_t √h)`, com σ_t = volatilidade EWMA (λ = 0,97) dos log-retornos de 1 barra; truncado a ±5.
- Características (todas causais, em t): retornos acumulados normalizados em 1, 3, 6, 12, 24, 48 barras; log da razão vol curta (6)/vol longa (96); log da razão volume/média de 24; posição no intervalo de 48 barras; ranking transversal do retorno de 24 barras; retorno de 24 barras e razão de vol do BTC; log σ_t; para 1 h, sen/cos da hora do dia; para todos, sen/cos do dia da semana.
- Regressão ridge com λ = 1000, treinada **walk-forward** (expansiva), reajustada a cada 30 dias (90 dias em 1 d), mínimo de 365 dias de treino, **purga** das amostras cujo alvo ainda não terminou à data de treino. Nenhum hiperparâmetro é ajustado com dados reais.
- Decisão em cada barra de cada moeda: `previsto_bps = |ŷ| · σ_t · √h · 10⁴`. Entra se `previsto_bps ≥ k · C` com C = 12 bps (ida e volta: 2 × (4,5 taker + 1,5 slippage)), lado = sinal de ŷ, entrada na abertura seguinte, saída ao fim de `h` barras (sem sobreposição por moeda). Sem martingale; cada trade pesa 1/40 do capital (alavancagem bruta máxima 1×).

## 4. Configurações (16, fixas)
Prazos/horizontes: (1 h, h = 6), (1 h, h = 24), (4 h, h = 6), (1 d, h = 5); k ∈ {1; 1,5; 2; 3}.

## 5. Períodos
Avaliação de 2020-01-01 até ao fim dos dados. Dividida no tempo em DEV (primeiros 50 %), VAL (25 %) e TEST (últimos 25 %). Antes de 2020 só se treina.

## 6. Regras de decisão
**Etapa 1 – existência (diagnóstico, não decide):** retorno bruto médio por trade de seguir o sinal sem limiar (k = 0) por prazo, em DEV+VAL, com IC por clusters de mês; correlação OOS entre ŷ e y; mesmo cálculo no controlo negativo (alvo deslocado circularmente 2 000 barras em cada moeda).

**Etapa 2 – finalistas (DEV+VAL):** uma configuração é finalista se (i) tem ≥ 300 trades em DEV+VAL; (ii) retorno líquido médio (C = 12 bps) > 0 em DEV **e** em VAL; (iii) p unilateral por clusters de mês, corrigido por Holm sobre as 16 configurações, < 0,05. Seguem para TEST, no máximo, as 2 de maior t.

**Etapa 3 – TEST (abre-se uma vez, só para finalistas):** passa se (a) líquido médio > 0 com p unilateral por clusters < 0,05 (Holm sobre ≤ 2); (b) líquido > 0 com custo 24 bps; (c) líquido > 0 em pelo menos 2/3 dos anos civis do período de avaliação com ≥ 30 trades; (d) queda máxima da carteira ≤ 25 %; (e) compras e vendas ambas com média líquida ≥ 0, ou o lado negativo identificado como limitação; (f) o mesmo pipeline no controlo negativo não passa em (a).
Passar = «**candidata**» (validada só em histórico, proxy de dados). Não é lucrativa nem implementável: faltam paper/demo, funding, taxa real e capital mínimo (a Hyperliquid exige ordens ≥ 10 USD, incompatível com carteira de 40 posições e 10 USD).

**Se nenhuma configuração for finalista, ou nenhuma passar a Etapa 3, o resultado do Ciclo 1 é «negativo» e relata-se assim.**

## 7. Diagnósticos exploratórios (não decidem)
Tabela por decil de ŷ (retorno realizado bruto); importância média das características (|β| padronizado); resultado por hora do dia, por regime do BTC (acima/abaixo da média de 24 barras), por compra/venda; variante só com características locais (sem ranking transversal nem BTC).
