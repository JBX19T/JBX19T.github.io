# Pré-registo — Ciclo 2: funding de perpétuos como informação nova (O2)

Escrito **antes** de qualquer corrida do Ciclo 2. Execução: `node scripts/research/edgemap.mjs --funding --out ciclo2-out`.

## 1. Porquê
O Ciclo 1 usou só preços/volume do próprio ativo e do BTC e não achou vantagem líquida (ver `PREREGISTO-CICLO1.md`, Adenda 1). O *funding* dos perpétuos mede o desequilíbrio de posicionamento (quem paga a quem para manter a posição): é informação **que não está nas velas**. Pergunta: acrescentar o funding melhora a previsão fora da amostra o suficiente para pagar os custos, **incluindo o funding efetivamente pago/recebido** durante a posição?

## 2. Dados
- Preços e universo: iguais ao Ciclo 1 (Binance spot, 1 h, 42 moedas; grelha até à última barra de qualquer moeda).
- Funding: ficheiros públicos mensais `data.binance.vision/data/futures/um/monthly/fundingRate/<SÍMBOLO>USDT/` (taxa de funding a cada 8 h, desde 2019-09 conforme a moeda). Moedas sem ficheiro de funding ficam fora do Ciclo 2 e são listadas.
- Limitações: (a) o funding é o da Binance USDT-M, não o da Hyperliquid (hora a hora, taxas diferentes); é uma aproximação; (b) preço de entrada/saída usa spot; a base spot–perpétuo é ignorada; (c) mesmos vieses do Ciclo 1 (universo escolhido hoje, só 2 de 42 moedas são ouro/EUR).

## 3. Modelo
Idêntico ao Ciclo 1 (alvo, ridge λ = 1000, walk-forward expansivo com purga, reajuste de 30/90 dias, mínimo 365 dias, 4 prazos × k ∈ {1; 1,5; 2; 3} = 16 configurações), com **5 características novas** (causais: usam só eventos de funding já ocorridos à data da decisão):
`fr_last` (última taxa, em bps por 8 h, truncada a ±30), `fr_m3` (média dos últimos 9 eventos), `fr_z` (z-score da última taxa face aos últimos 270 eventos, mín. 100), `fr_xs` (ranking transversal de `fr_m3`), `fr_tr` (`fr_last − fr_m3`).
**Custo:** C = 12 bps como no Ciclo 1 **mais o funding da posição**: `net = lado × retorno − 12 − lado × Σ funding(eventos entre a entrada e a saída)`. Posição comprada paga funding positivo e recebe negativo; vendida o contrário.

## 4. Decisão (regras do Ciclo 1, inalteradas)
Etapas 1–3 exatamente como no §6 do Ciclo 1. **Correção para famílias acumuladas:** o Holm da Etapa 2 faz-se sobre 16 + 16 = **32** hipóteses (as 16 do Ciclo 1 entram com p = 1, ou seja, tratadas como testadas e não confirmadas), e o da Etapa 3 como no Ciclo 1.
Diagnósticos (não decidem): correlação OOS e retorno bruto «seguir todos os sinais» **com** e **sem** as características de funding, sobre as mesmas linhas (comparação emparelhada); modelo só com funding; importância das características de funding; controlo negativo (alvo deslocado).

## 5. Reutilização do TEST
O TEST (últimos 25 % do tempo) coincide com o da 2.ª corrida do Ciclo 1. Os finalistas do Ciclo 1 só viram o TEST se passaram a Etapa 2. O Ciclo 2 abre-o para os seus próprios finalistas. Fica declarado que a mesma janela serve vários ciclos; a validação definitiva de qualquer candidata é a **demo/paper trading futura**, não este TEST.

## 6. Resultado negativo
Se nenhuma configuração for finalista ou nenhuma passar o TEST, o Ciclo 2 é negativo e relata-se assim.

---

## Adenda 1 — escrita DEPOIS de ver a 2.ª corrida do Ciclo 1 e ANTES de ver qualquer resultado do Ciclo 2

**Achado no Ciclo 1 corrigido (`f2c8451`):** para 1 d, h = 5, o **controlo negativo** (alvo deslocado) deu bruto **+115 bps (t ≈ +5)** — maior do que o modelo real (+52 bps). Causa provável: o modelo aprende uma ordenada na origem positiva (os ativos do universo, todos sobreviventes, subiram em média) e passa a estar quase sempre comprado, ganhando a deriva. Ou seja, «bruto positivo» pode ser **deriva do universo**, não previsão.

**Alterações (só tornam os critérios mais exigentes), aplicam-se ao Ciclo 2 e, retroativamente, ao Ciclo 1 (cujo resultado negativo não muda):**
1. **Critério adicional na Etapa 2:** para ser finalista, o ganho médio face a «sempre comprado nas mesmas entradas» tem de ser > 0, com p unilateral por clusters de mês < 0,05 (mede se o **sinal de direção** acrescenta valor além de escolher momentos).
2. **Critério (g) na Etapa 3:** o mesmo teste no TEST.
3. A tabela da Etapa 2 passa a mostrar esse ganho e o seu p para todas as configurações.

O resto do pré-registo mantém-se. A corrida do Ciclo 2 que estiver a decorrer com o código anterior **não conta**; só vale a corrida com este código.

---

## Resultado do Ciclo 2 (corrida `738a438`, a única que conta)

**Negativo, TEST não aberto.** O funding **não acrescenta previsibilidade**: correlação OOS com funding 0,0226 vs sem funding 0,0252 (1 h, h = 6); o modelo só com funding tem correlação ≈ 0 ou negativa em todos os prazos. Melhor configuração (1 h, h = 6, k = 3): líquido +12,9 bps [+0,5; +24,9] em DEV+VAL, mas p corrigido (32 hipóteses) = 0,70. O sinal de direção acrescenta +10 a +18 bps face a «sempre comprado» nas entradas de 1 h (p 0,003–0,04), ou seja há alguma informação direcional nas caudas, **mas não paga os custos** de forma estável (DEV fraco, VAL melhor, sem confirmação).
