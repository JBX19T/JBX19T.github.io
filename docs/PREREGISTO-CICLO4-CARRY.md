# Pré-registo — Ciclo 4: colheita de funding («cash-and-carry»)

Escrito **antes** de implementar e de correr. Execução: `node scripts/research/carry.mjs`.

## 1. Porquê é diferente de tudo o que falhou
Os Ciclos 1–3 e as Fases 1–2 tentavam **prever a direção** do preço; nada sobreviveu aos custos. Esta estratégia **não prevê nada**: compra o ativo à vista e vende o perpétuo na mesma quantidade (posição neutra ao preço) e **recebe o funding** que os compradores alavancados pagam aos vendedores. É um prémio de risco documentado (pagamento por fornecer alavancagem), não uma ineficiência que desaparece por ser descoberta. Ganha quando o funding é positivo; perde quando é negativo, com custos de entrada/saída e com variações da base (diferença perpétuo–spot).

## 2. Regras (fixas)
- **Mercados principais:** BTC, ETH, SOL (os três têm perpétuo e spot na Hyperliquid: UBTC, UETH, USOL). **Robustez:** + BNB, XRP, DOGE, ADA, LINK, LTC, AVAX (só como verificação; não têm todos spot na Hyperliquid).
- **Sinal (uma vez por dia, 00:00 UTC):** média das taxas de funding dos últimos 3 dias, expressa por 8 h (Binance: últimos 9 eventos; Hyperliquid: últimas 72 taxas horárias × 8). Só usa eventos já ocorridos.
- **Entrar** se média ≥ **0,005 % por 8 h**; **sair** se média < **0 %** (histerese: não entra e sai por ruído). Fora do mercado o capital fica parado (rendimento 0, conservador).
- **Execução:** à abertura diária (00:00 UTC) do spot e do perpétuo; quantidades fixas desde a entrada; o funding conta sobre o valor atual do perpétuo.
- **Capital e alavancagem:** capital igual por mercado (1/3 cada); valor nocional = 2/3 do capital do mercado (spot) e margem de 1/3 para o perpétuo vendido (alavancagem 2× na perna vendida). **Reequilíbrio:** se o perpétuo subir ≥ 30 % desde a entrada (abertura diária), fecha e reabre (pagando os custos), para não ser liquidado. **Liquidação:** se a máxima diária do perpétuo ficar ≥ 45 % acima da entrada, conta-se como liquidação (fecho forçado a esse preço + 1 % de penalização).
- **Custos (tabela base da Hyperliquid):** spot taker 7 bps + perpétuo taker 4,5 bps + deslizamento 2 bps por perna = **15,5 bps na entrada e 15,5 bps na saída**. Stress: ×2.
- Nenhum parâmetro é escolhido a partir dos dados.

## 3. Dados
- Preços diários: Binance spot (`data-api.binance.vision`) e Binance perpétuo USDT-M (ficheiros públicos `data.binance.vision`, mensais e diários).
- Funding: **E1** = Binance (8 h) desde 2019-09; **E2** = Hyperliquid (hora a hora, API pública `fundingHistory`) desde 2023-05 — é a bolsa onde o bot opera.
- Avaliação E1 desde 2020-01-01; períodos DEV/VAL/TEST = 50/25/25 % do tempo (só para estabilidade: não há parâmetros a escolher).

## 4. Critérios de aprovação (todos)
a) **TEST (E1, 3 mercados):** retorno diário médio > 0, p unilateral por clusters de mês < 0,05 **corrigido por Holm com as 47 hipóteses anteriores** (m = 48; na prática p < 0,05/48 ≈ 0,001);
b) TEST com custos ×2 > 0;
c) ≥ 2/3 dos anos civis positivos (anos com ≥ 6 meses de dados);
d) queda máxima da carteira ≤ 10 %;
e) **E2 (funding real da Hyperliquid):** retorno > 0 com p unilateral < 0,05;
f) nenhuma liquidação nos 3 mercados principais;
g) universo de robustez (10 mercados, E1, período completo): retorno > 0.

Passar = «**candidata a paper/demo**». Não é garantia de lucro futuro.

## 5. Limitações declaradas já
- O funding da Binance não é o da Hyperliquid (por isso o E2); a base perpétuo–spot da Hyperliquid pode diferir da Binance.
- Riscos fora do modelo: falência/ataque à bolsa, risco das pontes dos ativos UBTC/UETH/USOL, falhas de execução, mudanças de regras de funding, períodos longos de funding negativo.
- O retorno esperado é **modesto** (um prémio de juro, não «lucros elevados»).
- **Com 10 USD não é executável:** cada perna exige ordem ≥ 10 USD na Hyperliquid; um único mercado precisa de ≥ ~30–40 USD (spot + margem).
