# Pré-registo — Ciclo 3: carteira neutra ao mercado (long/short transversal) com limiar de custo

Escrito **antes** de implementar e correr. Execução: `node scripts/research/edgemap.mjs --neutral --out ciclo3-out`.

## 1. Porquê (o que os Ciclos 1 e 2 ensinaram)
1. Cada moeda era tratada como aposta direcional independente. O risco comum (mercado cripto) domina a variância: com ~80 meses de clusters, só se detetam vantagens enormes, e a **deriva do universo** (sobreviventes) pode passar por «previsão» (controlo de 1 d no Ciclo 1: +115 bps).
2. Há sinal direcional fraco nas caudas (decis extremos, 1 h: ≈ ±17–19 bps brutos) e a diferença «sempre comprado» é significativa em 1 h, mas é pequena face a 12 bps de custo e instável no tempo.
3. O funding não ajuda (Ciclo 2).

**Hipótese nova:** o que é previsível é a **posição relativa** entre moedas, não a direção do mercado. Uma carteira **neutra** (comprar as previstas como melhores, vender as previstas como piores, em valor igual) elimina a deriva e o risco comum, aumenta muito o poder estatístico e mede só a vantagem de seleção.

## 2. Dados e modelo
Dados do Ciclo 2 (41 moedas com funding; grelha 1 h até hoje; custo de funding incluído). Modelo ridge walk-forward do Ciclo 1 **sem** as características de funding, com **alvo transversal**: `y_xs = y − média de y das moedas válidas nessa barra`. Mesmos hiperparâmetros, purga e reajustes.

## 3. Carteira e custos
- Rebalanceamento a cada `h` barras (coortes sem sobreposição), a partir do início da avaliação. Em cada coorte, com ≥ 20 moedas válidas: comprar os 20 % com maior ŷ e vender os 20 % com menor ŷ (pesos iguais, 1 unidade de valor por perna).
- Retorno bruto da coorte (bps por unidade de perna) = média(retorno das compradas) − média(retorno das vendidas). **Custo = 2 × 12 bps** (cada perna paga 12 bps de ida e volta; renovação total a cada coorte, sem poupança por posições repetidas) **mais o funding líquido** (média do funding pago pelas compradas − média do funding das vendidas).
- Limiar de custo: só se negoceia a coorte se o spread previsto `(média ŷ compradas − média ŷ vendidas) × σ_bps` ≥ k × 2 × 12 bps; k = 0 significa «sempre».
- Retorno sobre capital = líquido da coorte / 2 (exposição bruta 1×).

## 4. Configurações (15)
Prazos/horizontes: (1 h, h = 6), (1 h, h = 24), (4 h, h = 6), (1 d, h = 5), (1 d, h = 10); k ∈ {0; 1; 2}.

## 5. Decisão
- **Etapa 2 (DEV+VAL):** finalista se (i) ≥ 150 coortes negociadas em DEV+VAL; (ii) líquido médio > 0 em DEV e em VAL; (iii) p unilateral por clusters de mês, **Holm sobre 15 + 32 = 47** hipóteses (as dos Ciclos 1 e 2 entram com p = 1), < 0,05. No máximo 2 (maior t) seguem para TEST.
- **Etapa 3 (TEST, uma vez):** (a) líquido > 0 com p corrigido (Holm ≤ 2) < 0,05; (b) líquido > 0 com custo ×2 (2 × 24 bps); (c) ≥ 2/3 dos anos civis > 0 (com ≥ 20 coortes); (d) queda máxima da carteira ≤ 25 % (capital, 1× bruto); (e) **as duas pernas contribuem**: retorno médio das compradas acima da média da barra ≥ 0 **e** das vendidas abaixo da média da barra ≤ 0 (a vantagem não vem de uma perna só); (f) o mesmo pipeline no controlo negativo (alvo deslocado) não passa em (a).
- Se nenhuma for finalista ou nenhuma passar: **resultado negativo**, relatado assim.

## 6. Limitações (declaradas já)
Universo de sobreviventes (cria viés de seleção mesmo em carteira neutra, em menor grau); preços spot, funding Binance; 20 % de ~40 moedas = 8 posições por perna → **não executável com 10 USD** (ordens mínimas da Hyperliquid); deslizamento maior em moedas pequenas não modelado além de 12 bps; o TEST é o mesmo dos ciclos anteriores. Qualquer candidata exigiria demo/paper com capital e execução reais.
