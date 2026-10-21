# DOLLOS TRADE BOT — Auditoria técnica, diagnóstico das perdas e correções

Data: 2026-10-19. Âmbito: `grokbot/` (app e APK), `worker/` (Cloudflare Worker), testes e CI.
Regras seguidas: nenhuma ordem real foi enviada; `HL_LIVE`, `SOL_LIVE` e `HL_AUTOPILOT` não foram ativados; nenhuma estratégia nova foi criada;
nenhum parâmetro foi afinado para melhorar um resultado. A Hyperliquid e a Jupiter/Solana foram preservadas.

> **Resumo honesto.** As perdas não vêm de um erro de código que, corrigido, as faça desaparecer. Vêm de (1) **nenhuma estratégia ter vantagem
> mensurável antes de custos** e (2) **custos de 0,21–0,40 R por trade**, que sozinhos explicam 59%–137% da perda. Encontrei e corrigi **19 problemas
> confirmados** (a maioria faz o backtest parecer melhor do que a execução real, ou deixa o dinheiro real menos protegido). Nada disto prova que o
> bot vá ganhar; prova que o teste e a proteção passam a dizer a verdade.

---

## 1. Problemas confirmados (cada um com teste que falhava antes da correção)

Os testes `audit.test.mjs` (B1–B9, Bt1–Bt3) foram escritos **antes** das correções e corridos contra o código original: **9 de 10 falharam**
(a exceção, B6, confirmou que o dimensionamento está certo). Os restantes problemas foram confirmados por leitura do código + reprodução.

| # | Problema | Evidência | Correção | Teste |
|---|---|---|---|---|
| C1 | O `.zip` que te enviei **não tinha `grokbot/backtest.js`**; o teste do backtest falhava ao ser extraído sozinho | `Cannot find module '../../grokbot/backtest.js'` reproduzido. No repositório o ficheiro existe e o APK é idêntico ao código-fonte (8 ficheiros comparados byte a byte) | `scripts/pack-worker.mjs` calcula o fecho de dependências (30 ficheiros) | `pack.test.mjs` (extrai o zip numa pasta limpa e corre o teste) |
| C2 | O backtest entrava **ao fecho da vela que gerou o sinal**: preço impossível de obter (o sinal só existe quando a vela fecha) | Bt1: entrada 101,0 em vez da abertura seguinte 101,5 | Ordem a mercado enche à **abertura da vela seguinte** | Bt1, backtest 1–2 |
| C3 | **Slippage omitido** no backtest e no desk em papel (só havia a taxa) | `slipBps` não existia | `slipBps` (3) e `slipStopBps` (5) por lado; **são suposições**, a substituir pelo medido (ver C19) | Bt1, macro M5 |
| C4 | O alvo era simulado como ordem a mercado (taxa taker, enche ao tocar), mas na Hyperliquid é uma **ordem limitada** (taxa maker, só enche se o preço a ultrapassar) | Bt2: taxas 0,0018 em vez de 0,0012 | `tpMode:'limit'` (omissão, como a execução) ou `'market'` (`HL_TP_TRIGGER=1`) | Bt2 |
| C5 | O filtro de volatilidade (`ATR ≥ 2×custo`) mede o custo contra o **alvo**, não contra o **risco**: deixa entrar trades que custam até **0,5 R** | Bt3; nos CSV reais o custo foi 0,21–0,40 R/trade | `custo de ida e volta ≤ 15% do risco` (`maxCostR`) | Bt3, macro M6 |
| C6 | O desk em papel lia **Lighter (PAXG, SPY ≈ $760)**, mas o worker executa em **`xyz:GOLD`, `xyz:SP500` (≈7600), `xyz:EUR`** na Hyperliquid, e o backtest usa estes últimos: o sinal nascia num feed e era executado noutro | `MK[].match` em `macro.js`: `PAXG`, `SPY` | Feed padrão = Hyperliquid (`allMids` + `candleSnapshot`); Lighter só com `?feed=lighter` | macro M1, M2 |
| C7 | O desk decidia com a **vela ainda aberta** (que muda a cada tick); o backtest nunca a vê | `signal(p.bars)` incluía a última vela, incluindo a de 1 tick | Só velas fechadas; uma decisão por vela; no arranque não decide sobre vela antiga | M3, M4 |
| C8 | A proteção de −20% dava a posição por fechada **mesmo que o fecho falhasse** e nunca voltava a tentar | B1: 1 tentativa, posição fica aberta | Insiste a cada 5 min enquanto houver posição; avisa da falha | B1 |
| C9 | Se a proteção não conseguisse ler a corretora (429, falha de rede), **ficava cega sem avisar** | B2: 0 notificações em 4 falhas | Aviso após 3 falhas seguidas (15 min), repete a cada 6 h, e avisa quando recupera | B2 |
| C10 | Um token **já existente na carteira** (sem registo de entrada) era vendido pelo "alvo do servidor" por a base ser o bilhete nominal ($2): um token de $50 contava como +2400% | B3: vendeu | Adota o valor atual como base e conta o tempo a partir daí | B3 |
| C11 | Duas sincronizações simultâneas (dois aparelhos, ou app + servidor) **compravam duas vezes** | B4: 2 transações enviadas | Trava atómica no Durable Object (`lock`, expira em 90 s) | B4 |
| C12 | A trava de "só opera com estratégia aprovada" existia **só na app**: um cliente antigo ou alterado ignorava-a | B5: planeava aberturas sem aprovação | O worker recusa abrir sem aprovação válida (45 dias); na rede real não há como desligar | B5, R6 |
| C13 | O worker reconhecia o stop por `orderType` contendo "stop", campo **cujo valor real não está verificado**. Se vier diferente, **empilhava um stop novo a cada sincronização** | B9: 6 ordens em 6 sincronizações | Reconhece o stop pela **geometria** (gatilho abaixo do preço numa posição longa); formato desconhecido ⇒ não empilha | B9 |
| C14 | Se a ligação caísse entre a entrada e o stop, a posição ficava **sem stop** (a app fechada e sem piloto ninguém o repunha); stops fechados deixavam **ordens órfãs** | leitura de `hl.mjs` | A proteção repõe o stop (2% da entrada) e cancela órfãs; só stops e cancelamentos, nunca abre | R2, R3, R4 |
| C15 | Paper das memecoins: **a saída não pagava custo nenhum** (nem slippage nem taxa) e a entrada só slippage. Além disso uma chamada `say('fills',…)` estava **dentro de um comentário** (código morto) | `closePos`: `r=p.px/p.entry-1` | Saída paga slippage (tamanho/liquidez) + taxa da pool (50 bps/lado, **suposição**) | browser: fecho a preço de entrada dá −1,5% |
| C16 | A "aprovação" era renovável: `/hl/approve` carimbava `Date.now()`, por isso a validade de 45 dias nunca expirava | leitura de `holders.mjs` | O prazo conta desde a data do teste | R6 |
| C17 | A Hyperliquid devolve a **vela em formação** e o backtest incluía-a | `candleSnapshot` até `endTime=agora` | `toBars` filtra velas fechadas | revisão + UI |
| C18 | A base de custo das memecoins era o bilhete **nominal**, não o USDC realmente gasto na cotação; vendas não registavam resultado realizado | `x.usd` em `holders.mjs` | Base = `inAmount` da cotação; resultado de cada venda registado | R/exec log |
| C19 | **Não havia registo do que foi realmente executado** (preço pretendido vs executado, taxa cobrada), logo o slippage e o custo reais nunca puderam ser medidos | inexistente | `execLog` (últimas 300 ordens), taxas reais de `userFills` a cada 5 min, trades do desk em papel com `risk` e `cost` | R1, R7, R8, M5 |

**Verificado e correto (não alterei):** assinatura das ordens (igual ao SDK oficial); um só trade por mercado; stop ganha empate com alvo; gaps enchem à
abertura; funding com o sinal certo; **tamanho das posições**: em 30 combinações (saldo $10–$1000 × stop 0,4%–6%) o risco real foi **≤ 1,00%** do saldo
(24 casos abertos; 6 recusados por ficarem abaixo do mínimo de $10) e a exposição nunca passou de 2,7× (teste B6).

## 2. Problemas prováveis (não provados)

- **P1** Valores de campos da API que não consegui verificar (sem acesso à rede neste ambiente): `orderType` e `isTrigger` de `frontendOpenOrders`;
  se `frontendOpenOrders` aceita o parâmetro `dex`; os nomes dos campos de `userFills`. O código já não depende de `orderType` (C13), mas o resto precisa de confirmação na rede de teste.
- **P2** A taxa dos mercados `xyz` (HIP-3) não está confirmada: 9 bps por lado é um valor de uma fonte secundária. Agora é **medida** (`/risk/state → feeStats`).
- **P3** Unidades de `priceImpactPct` da Jupiter (fração vs percentagem). O código assume fração; um erro faria o limite de 5% ser 100× mais fraco ou mais forte. Verificar com uma cotação real.
- **P4** Entradas às 12–14 h UTC perdem mais nas três amostras (15 min: −0,87 R em 10 trades; 1 h: −0,76 R em 19 e −0,52 R em 16; 4 h: −0,32 R em 44). As três amostras cobrem o **mesmo período**, por isso **não são evidência independente**. Não implementei nada com base nisto.
- **P5** Saldo por dex da Hyperliquid (`accountValue` do dex `xyz` vs conta principal) pode comportar-se de forma diferente com contas "unificadas".
- **P6** Cada memecoin comprada deixa uma conta de token (rent 0,00204 SOL ≈ $0,31 a SOL=$150) que o bot **não fecha**: dinheiro preso (~15% de um bilhete de $2).
- **P7** Se o estado do Durable Object for apagado (nova migração), o máximo da conta volta a 0 e uma paragem ativa é esquecida.

## 3. Dados que faltam (e o que já fica a ser registado)

| Dado | Estado |
|---|---|
| Execuções reais (preço pretendido vs executado) | **Passa a ser registado** (`GET /exec/log`) — só existe quando houver ordens reais |
| Taxa efetivamente cobrada (taker/maker) | **Passa a ser medida** (`/risk/state → feeStats`) |
| Resultado realizado de cada memecoin | **Passa a ser registado** |
| Trades fechadas do desk de memecoins (CSV) | **Falta** — não recebi; sem elas não consigo diagnosticar as memecoins |
| Trades do histórico longo (Binance) em CSV | **Falta** — só vi os resumos; os CSV de 15 min, 1 h e 4 h são da Hyperliquid |
| Funding do EUR/USD e do S&P no histórico longo | **Falta** (a Binance não tem S&P; o EUR/USD vem de EURUSDT) |
| Cotações bid/ask e profundidade dos mercados `xyz` | **Falta** (sem elas o slippage é uma suposição) |
| Latência real entre sinal e ordem | **Falta** |

## 4. Causas das perdas, sustentadas por evidências

Medi em `t.csv` (15 min, 50 trades), `h1.csv` (1 h, 233 trades) e `h4.csv` (4 h, 137 trades): os CSV exportados pela app (Hyperliquid, 2026).
R = resultado em múltiplos do risco da trade (1 R = 1% da conta).

| Amostra | R líquido | **R bruto (antes de custos)** | Custo/trade | Taxas ÷ perda | Acerto | Stop mediano |
|---|---|---|---|---|---|---|
| 15 min | −0,623 (t=−4,4) | **−0,227 (t=−1,6)** | 0,40 R | 59% | 24% | 0,43% |
| 1 h | −0,350 (t=−4,6) | **−0,049 (t=−0,6)** | 0,30 R | 87% | 32% | 0,71% |
| 4 h | −0,151 (t=−1,5) | **+0,061 (t=+0,6)** | 0,21 R | 137% | 39% | 1,41% (ouro) |

1. **Nenhuma vantagem antes de custos.** O R bruto é estatisticamente indistinguível de zero nas três amostras (|t| < 2). Os testes de 6 anos (Binance, que me enviaste em capturas) dão o mesmo: rompimento −0,02 R bruto em 4 h; nenhuma das 5 estratégias passou o teste em duas partes.
2. **Os custos fazem o resto.** 0,21–0,40 R por trade. As taxas pagas (US$4 503 em 1 h) são 45% da conta em 206 dias.
3. **O custo em R depende da distância do stop**: `custo_R = 2×custo / stop%`. Tabela medida: stop 0,43% → 0,39 R; 0,71% → 0,26 R; 1,41% (ouro 4 h) → 0,14 R; 0,49% (EUR/USD 4 h) → 0,38 R. É por isso que o EUR/USD e as velas curtas perdem mais.
4. **O pagamento é assimétrico:** stop −1,1 a −1,2 R, alvo +1,1 a +1,4 R; sem custos o empate exige ~40% de acerto; só houve 24–39%.
5. **Correlação não é a causa principal:** 3% / 19% / 38% do tempo em posição tinha 2 ou mais posições; os 3 piores dias custaram −2,2% a −3,2%.
6. **Os erros de fidelidade (C2–C7)** faziam o backtest parecer *melhor* do que a execução; não criam as perdas, escondem-nas.

## 5. Ficheiros alterados

Novos: `worker/execlog.mjs`, `scripts/pack-worker.mjs`, `.gitignore`, `docs/AUDITORIA.md`, testes `audit`, `risk`, `macro`, `pack`.
Alterados — worker: `guard.mjs` (reescrito), `holders.mjs`, `hl.mjs`, `sol.mjs`, `store.mjs`, `autopilot.mjs`, `package.json`, testes `backtest`, `guard`, `router`, `sol`.
Alterados — app: `strategy.js`, `backtest.js`, `macro.js`, `live.js`, `results.js`, `backtest-ui.js`, `index.html` (desk de memecoins), `sw.js` (cache v32). CI: `.github/workflows/worker.yml` (passa a vigiar `macro.js`, `scripts/`).

## 6. Testes executados e resultados

Antes de qualquer alteração: `node --test` em `worker/` → **6 ficheiros, 6 aprovados** (mas o zip enviado não os conseguia correr, C1).
Depois: **11 ficheiros, 11 aprovados, 0 falhas** (`node --test`, Node 22). Linhas `ok` por ficheiro:
`audit` 10 · `backtest` 20 · `guard` 13 · `hl_flow` 26 · `hl_sign` 5 · `macro` 6 · `pack` 2 · `risk` 8 · `router` (4 blocos) · `scalp` 6 · `sol` 24.
Também corridos em Chromium sem janela, com respostas simuladas da Hyperliquid, do worker e da Binance: painel do teste histórico (inclui histórico longo e
exportação CSV), painéis HYPERLIQUID/SOLANA (paragem global, RETOMAR TUDO, EMERGÊNCIA, slippage real), desk em papel com o feed da Hyperliquid
(nenhum pedido ao Lighter), desk de memecoins em demo (fecho com custos). **Sem erros de página.**
**Não foi possível** testar contra a Hyperliquid, a Jupiter e a Binance reais (o ambiente bloqueia esses endereços): tudo o que depende da API real está em «Prováveis» (secção 2).
Controlo estatístico: em 120 séries aleatórias passou **1** com o limiar final (t ≥ 2,5; com t ≥ 2,0 teriam passado 2), isto é, cerca de 1 %; num mercado com reversão à média genuína o critério passa (t = 3,9).

## 7. Melhorias na gestão de risco

| Controlo | Antes | Depois |
|---|---|---|
| Limite de perdas / drawdown | −20% desde o máximo (HL) e −30% por memecoin | igual, mas **insiste no fecho** e avisa se falhar (C8) |
| Tamanho das posições | correto (B6) | igual + filtro custo/risco (C5) |
| Exposição total | `HL_MAX_GROSS_USD`, `SOL_MAX_OPEN` | igual |
| Limites por plataforma | por plataforma | igual + **paragem global** entre plataformas |
| Falhas de rede | silenciosas | aviso após 15 min, repetição a cada 6 h, aviso de recuperação |
| Ordens repetidas | sem proteção na Solana | **trava atómica** (HL e Solana, app e servidor) |
| Paragem de emergência | por plataforma, na app | `POST /risk/panic`: fecha tudo e bloqueia entradas; **RETOMAR TUDO** levanta |
| Stops | só no momento da entrada | repostos pela proteção; órfãs canceladas; stop móvel só aperta (novo antes de cancelar o velho) |
| Validação estatística | só na app | **também no worker**; rede real sempre exigida; prazo desde o teste |
| Recuperação após reinício | estado no Durable Object | igual; **limitação P7** |
| Funciona com a app fechada? | sim (cron de 5 min) | sim; o aviso de "sem notificações" aparece na app se faltar `NTFY_TOPIC` |

Sem martingale; o risco por trade nunca aumenta após perdas.

## 8. Comparação entre resultados anteriores e posteriores

**(a) Fidelidade do motor** — mesmos dados, **sem vantagem nenhuma** (passeios aleatórios com a volatilidade de cada tamanho de vela; 12 sementes × 3 mercados × 12 000 velas).
Se o motor fosse honesto, o R bruto seria ≈ 0 e o R líquido ≈ −custo:

| Velas | Motor | Trades | R bruto | Custo (R) | R líquido |
|---|---|---|---|---|---|
| 4 h | antigo | 1 580 | +0,017 | 0,171 | −0,154 |
| 4 h | novo, sem filtro | 1 575 | +0,019 | 0,211 | −0,192 |
| 4 h | **novo, com filtro** | 1 023 | +0,019 | 0,142 | **−0,124** |
| 1 h | antigo | 1 227 | +0,021 | 0,269 | −0,248 |
| 1 h | novo, sem filtro | 1 562 | +0,033 | 0,426 | −0,393 |
| 1 h | **novo, com filtro** | ~0 | — | — | (não opera) |
| 15 min | antigo | 791 | +0,014 | 0,440 | −0,426 |
| 15 min | novo, sem filtro | 1 323 | +0,038 | 0,946 | −0,908 |
| 15 min | **novo, com filtro** | 0 | — | — | (não opera) |

Leitura: o motor antigo **subestimava os custos** (0,171 vs 0,211 R em 4 h; 0,44 vs 0,95 R em 15 min). O novo é mais severo e o filtro corta as trades em que o custo é
desproporcionado. **Com zero vantagem o bot continua a perder (−0,124 R por trade em 4 h): o filtro reduz a perda, não cria lucro.**

**(b) Efeito do filtro nos teus CSV reais** (apenas ilustração **dentro da amostra**): o filtro teria bloqueado 50/50 trades de 15 min, 225/233 de 1 h e 83/137 de 4 h.
Nas 54 trades de 4 h que passariam, o R líquido seria −0,122 e o bruto −0,019: continua sem vantagem.
**Aviso:** o limiar de 0,15 R é uma convenção, mas fixei-o depois de ver estes números. Por isso este resultado **não conta como prova**; só conta o que o teste fizer em dados novos.

**(c) Resultados reais:** não posso apresentar comparações «antes/depois» em dados reais, porque o ambiente não alcança as corretoras. O teu próximo teste histórico dará esses números.

## 9. Limitações ainda existentes

- Nenhuma estratégia tem vantagem comprovada; o bot, tal como está, **não deve operar com dinheiro real**. A trava mantém-no bloqueado.
- Slippage (3/5 bps) e taxa das memecoins (50 bps) são **suposições**. A aprovação dos testes depende delas.
- A aprovação estatística é **atestada pela app**: o worker valida os números e as datas, mas não recalcula o teste (não cabe no tempo de CPU do plano grátis). Um cliente malicioso com o token poderia forjá-la.
- O desk de memecoins em papel não tem stops de volatilidade nem dados de custo reais; para bilhetes de $2 os custos fixos pesam muito (ver abaixo).
- Stops e alvos do desk em papel avaliam-se a cada 15 s, não a cada negociação; picos entre leituras não aparecem.
- O backtest usa uma única divisão 60/40; repetir o teste vezes demais pode produzir um falso positivo por acaso (a regra `t ≥ 2,5` reduz mas não elimina isso: cada corrida tem cerca de 0,6% de hipótese de passar por acaso, e 10 corridas somam ~6%).
- O worker só gere os três mercados mapeados; posições noutros mercados da conta não são fechadas.
- Se o plano grátis da Cloudflare limitar pedidos, a proteção de 5 em 5 minutos pode atrasar.

**Custo de um bilhete de $2 na Solana** (fórmula; o preço do SOL deve ser confirmado): taxa de rede 5 000 lamports + prioridade até 200 000 por transação (`SOL_MAX_PRIORITY_LAMPORTS`)
⇒ ida e volta ≤ 0,00041 SOL ≈ **$0,06 a SOL=$150 (3,1% do bilhete)**; taxa da pool 0,25–1% por lado; slippage até 3% por lado; mais **$0,31 de rent preso** por token.
O desk em papel tem alvo +35% e stop −14%: custos de 5–11% por ida e volta são relevantes face ao stop.

## 10. Passos necessários para validar o sistema

**Etapa 0 — sem dinheiro, na rede real em simulação (recomendado primeiro).** `HL_LIVE` e `SOL_LIVE` **desligados** (nunca definidos).
1. Publica (merge → o GitHub publica o worker e o APK). No painel HYPERLIQUID toca LIGAR: confirma que os mercados mostram os preços certos (ouro ≈ onça, S&P ≈ índice, EUR/USD ≈ 1,1).
2. Abre o painel do **TESTE HISTÓRICO**; corre 4 h e 1 h; corre «Histórico longo». Confirma que o veredicto continua a ser «não passou» (é o esperado). **Não retestes até «passar»**: cada repetição aumenta o risco de um falso positivo.
3. Confirma que o desk em papel mostra «HYPERLIQUID · LIVE» e que a nota diz «mesmos mercados onde o worker executa».
4. Configura `NTFY_TOPIC` e toca TESTAR NOTIFICAÇÃO.

**Etapa 1 — rede de teste da Hyperliquid** (só quando tiveres conta de teste; a faucet pode exigir um depósito prévio na rede real, que ainda não fizeste):
`HL_NETWORK=testnet`, `HL_LIVE=1`, `HL_REQUIRE_APPROVAL=0` (só vale na testnet). Verifica, por ordem: (a) entrada com stop e alvo limitado; (b) `GET /hl/state` mostra o **stop** de cada posição (confirma P1); (c) cancela o stop à mão na interface: a proteção deve repô-lo em ≤ 5 min; (d) cancela o alvo depois de fechar: deve ser removido; (e) `POST /risk/panic` fecha tudo; (f) `GET /exec/log` tem o slippage real; (g) `/risk/state → feeStats` tem as taxas reais; **compara-as com 9/3 bps**.

**Etapa 2 — Solana** (só com carteira dedicada e ≤ $2): `SOL_LIVE=1`, `SOL_TICKET_USD=1`, um token líquido. Verifica a cotação (P3: unidades do impacto), a confirmação, o registo em `/exec/log`, a venda pela proteção (`SOL_GUARD_MAX_HOURS=0.5` para forçar) e que duas sincronizações simultâneas não duplicam.

**Etapa 3 — semanas em papel** com o feed novo; só reabrir a conversa sobre dinheiro real se uma estratégia **passar** o teste (e, de preferência, com o slippage e a taxa já medidos e substituídos nas suposições).

**Antes de qualquer passagem a produção:** `HL_NETWORK=mainnet` exige ainda `HL_CONFIRM_MAINNET=YES` e uma aprovação válida; começa com o menor valor possível. Nenhuma promessa de lucro é feita aqui.

---

## 11. Modo scalping (adicionado depois da auditoria)

**O que é:** uma sexta família, `scalp`, para velas de **1 min e 5 min**: reversão curta (fecho a mais de 2,2 desvios-padrão da média de 20 velas),
stop 1,2×ATR, alvo 1×ATR, no máximo 12 velas. Parâmetros fixados a priori (convenção Bollinger), não afinados. Escolhe-se no Macro Desk
(menu «Modo»: *Padrão · rompimento · 15 min*, *Scalping · 5 min*, *Scalping · 1 min*) e no teste histórico (opções de 1 min e 5 min).
Nas velas de scalping o teste compara só o scalping, com ordens a mercado e limitadas, e mostra a variante «sem filtro de custo (só para ver o estrago)».

**O que NÃO faz, de propósito:**
1. **Não executa em real.** O worker sincroniza de 30 s (app aberta) a 5 min (cron); uma ordem de scalping chegaria minutos depois do sinal, quando o movimento já passou.
   O `/hl/sync` e o piloto automático recusam abrir quando a estratégia é `scalp` ou as velas são de 1/5 min, **mesmo com aprovação válida** e na rede de teste (teste `S4`).
   Para executar scalping a sério seria preciso um serviço com WebSocket e ordens limitadas (maker) geridas em segundos; isso não existe aqui.
2. **Não afrouxa o filtro de custo** (continua 15% do risco): afrouxá-lo só serviria para o bot operar mais e perder mais.

**Porque quase nunca opera (matemática, não opinião):** `custo_R = 2 × custo ÷ distância do stop`. Em velas de 5 min o ouro tem ATR ≈ 0,1%; com stop de 1,2×ATR ≈ 0,12–0,14%
e custo de ida e volta de 0,18% (9 bps por lado), o custo vale **mais de 1 R**. Medido no mercado simulado sem vantagem (teste `S2`, 20 000 velas de 5 min, ouro e EUR/USD):
**sem o filtro, 2 245 trades com custo médio 3,5 R e resultado médio −3,5 R por trade; com o filtro, 0 trades.** No desk em papel o cartão do ouro mostra «custo 1,46 R por trade (máx. 0,15)».
Para o scalping ser viável seria preciso, ao mesmo tempo, taxas muito mais baixas (maker nos dois lados) e uma vantagem real por trade acima do custo; nenhuma das duas está demonstrada.

**Como testar:** painel TESTE HISTÓRICO → 5 min (ou 1 min) → CORRER TESTE; opcionalmente «Histórico longo» (Binance: ~100 dias de 5 min, ~20 dias de 1 min).
A Hyperliquid só guarda 5000 velas (17 dias de 5 min; 3 dias de 1 min), por isso o veredicto em velas de 1 min é sempre fraco.

### Correção ao controlo estatístico (secção 6)
Com 6 famílias × 2 execuções, em séries **sem vantagem** o critério `t ≥ 2` deixava passar cerca de 2–3% por corrida (1 em 40 na primeira medição).
O limiar passou a **t ≥ 2,5** (`APPROVAL_MIN_T`), fixado pela taxa de falsos positivos em dados aleatórios, não pelos resultados reais. Medição final em dados aleatórios (120 séries): 1/120 passaram com t ≥ 2,5 contra 2/120 com t ≥ 2,0.

## 12. Day trade e swing trade (adicionados depois do scalping)

Os dois modos usam as mesmas regras de entrada do rompimento, com enquadramento diferente. O menu de modo existe no Macro Desk e no Teste histórico («Padrão», «Day trade», «Swing», «Scalping»).

| Modo | Velas | O que muda | Execução real |
|---|---|---|---|
| Day trade (`daytrade`) | 15m, 1h, 4h | fecha tudo na última vela do dia UTC («fim do dia»); não abre nas últimas 2 h do dia; stop 2×ATR, alvo 3×ATR, máx. 24 velas | possível, com aprovação própria (estratégia + velas) |
| Swing (`swing`) | 4h, 1d | sem alvo fixo; stop móvel 3×ATR; até 60 velas (dias a semanas) | possível, com aprovação própria |

Notas honestas:
- **Nenhum dos dois foi provado lucrativo.** Passam pelo mesmo teste em duas partes e pelo mesmo limiar (t ≥ 2,5, ≥ 30 trades na parte B) que as restantes estratégias; sem esse teste o worker recusa abrir.
- Day trade em velas de 1 h é muitas vezes bloqueado pelo filtro de custo por risco (o custo em R fica acima de 0,15). Isto é intencional.
- Swing em velas diárias gera poucos trades; usar «Histórico longo» (Binance) para ter amostra.
- O fecho de fim do dia só acontece com a app aberta ou com o piloto automático ligado; fora disso ficam apenas o stop e o alvo na corretora.
- O backtest compara cada modo só com a sua própria família (não mistura com as cinco clássicas).
- Testes: `worker/test/modes.test.mjs` (definições, fecho de fim do dia, janela sem entradas, swing diário, Macro Desk, piloto, aprovação).

## 13. Auditoria quantitativa em dados reais (2026-10-21)

Relatório completo, gerado por `scripts/audit-real.mjs` com dados públicos da Hyperliquid e da Binance: `docs/AUDITORIA-DADOS-REAIS.md`. Corre no GitHub Actions (workflow «Auditoria em dados reais») porque o ambiente de desenvolvimento não chega a estas APIs. Repetível: `node scripts/audit-real.mjs`.

**Correção de contexto:** o DOLLOS não usa o MetaTrader 5. Opera com a API da Hyperliquid (mercados `xyz:` de ouro, S&P 500 e EUR/USD) e Jupiter/Solana. Não há spreads, swaps nem lotes de MT5: os custos modelados são taxa taker/maker, slippage e funding da Hyperliquid.

### 13.1 O que foi acrescentado ao motor
- **Diagnóstico por vela** (`simulate().diag`): para cada vela avaliada, a razão da entrada ou da recusa, sinais que o filtro de custo bloqueou, ATR% face ao mínimo exigido e a cadeia sinais → ordens → execuções → trades. Aparece na app («Porque entrou ou não entrou») e, com `opts.log`, como CSV por vela.
- **Veredicto honesto com 0 trades:** deixou de dizer «teria perdido 0,0 %»; diz que não houve operações e porquê.
- **Estatísticas completas** (`analyze`): ganhos/perdas brutos, relação ganho/perda, expectativa em $ e R, queda em $ e %, maior sequência de perdas, custos por componente, e desempenho por mercado, saída, sessão (UTC), regime de volatilidade (terços do ATR%) e mês.
- **Recálculo cruzado** (`crossCheck`): recalcula contagens, resultado, fator de lucro, R e custos a partir das trades e compara com o relatório; conta final − inicial tem de igualar a soma das trades.
- **Incerteza:** intervalo de confiança a 95 % da média em R por *bootstrap por blocos* (trades consecutivas, para respeitar a dependência) e estatística t.
- **R ponderado pelo risco** (Σ resultado ÷ Σ risco) ao lado do R simples, e média por trade em $.
- **Protocolo em 3 partes** (`protocol`): desenvolvimento / validação / teste final; hipóteses de um só parâmetro fixadas antes de correr; regra de «promissora» fixada antes; teste final só para a referência e as promissoras; limiar t corrigido pelo número de variantes (Bonferroni).
- Testes: `worker/test/quant.test.mjs` (8 grupos, resultados definidos antes de correr).

### 13.2 Respostas

**1. Porque é que o Rompimento 15 min não fez operações?** Demonstrado: o filtro de custo recusou **99,0 %** das velas avaliadas (14 835 de 14 985). O ATR típico em 15 min é de 0,12 % no ouro (mediana), 0,05 % no S&P 500 e 0,03 % no EUR/USD, e o filtro exige pelo menos 0,60 % (custo de ida e volta ≤ 15 % do risco com 9 bps de taxa). Nenhuma vela de nenhum mercado passou o mínimo. Não há erro de dados (velas ordenadas, sem duplicados, sem lacunas, sem velas inválidas) nem de indexação: sem o filtro há 532 trades (−90,3 %, fator de lucro 0,06, **−3,97 R por trade**: o custo vale vários R quando o stop é minúsculo); com custo de 2 bps há 98 trades e −20,7 % (fator 0,52). O filtro está correto e faz parte das regras; o que a 15 min não existe é vantagem bruta suficiente. 1 140 sinais foram bloqueados (535 compra, 605 venda).

**2. Porque é que o Day trade 4h foi negativo?** Reproduzido exatamente (71 trades, −$168,72, fator 0,93). **Antes de custos ganha +0,12 R por trade e os custos são 0,14 R**: taxas $735 + slippage $255 sobre 71 trades. Sem slippage seria +0,4 %. Take-profit (+$1 507) e stop-loss (−$1 553) anulam-se. Incerteza: IC95 % da média em R [−0,18; +0,15], t = −0,21: indistinguível de zero. No histórico longo (Binance, 6,8 anos, ouro e EUR/USD, 289 trades) é **negativo com significância**: −0,15 R por trade, IC [−0,21; −0,08], t = −3,76; antes de custos +0,01 R (não há vantagem bruta). Ressalva: PAXG e EURUSDT são proxies, e a taxa de 9 bps é suposição (ver §9).

**3. A média por operação do Swing 4h está bem calculada?** Sim. Recalculado a partir das trades: 38 trades, Σ ganhos $2 165,54, Σ perdas $2 180,02, líquido −$14,47 (−$0,38 por trade); fator de lucro 0,99; R bruto +0,17 − custos 0,16 = +0,01 R. A aparente contradição (+0,01 R com resultado negativo) vem de a média simples em R dar o mesmo peso a cada trade, enquanto o risco em $ varia com a conta (1 % da conta de cada momento); o R ponderado pelo risco (Σ resultado ÷ Σ risco) dá −0,00 R, com o sinal do resultado. Verificado nas trades reais: o risco por trade varia entre $98,11 e $109,38 (acompanha a conta), a soma simples em R é +0,30 mas resultado ÷ risco médio = −0,14 R (−$14,47); reproduzido também com números conhecidos em `quant.test.mjs` (Q5). Em qualquer das medidas o valor é zero: IC95 % [−0,40; +0,45], t = 0,03. Não há operações abertas no fim, nem parciais.

**4. Erros confirmados e corrigidos nesta fase?** Nenhum erro de cálculo no motor: o recálculo cruzado ficou coerente nas 8 corridas e a cadeia sinais → ordens → execuções → trades conserva-se em todas. Corrigidos: (a) o veredicto com 0 trades era enganador; (b) faltava ao relatório o diagnóstico de entradas, o R ponderado e a incerteza; (c) a «média por trade» só existia em R. As correções de fidelidade do motor (entrada na abertura seguinte, custos, stops, gaps) são as da auditoria anterior (§1).

**5. O que melhorou ou piorou os resultados?** Nada foi retocado para melhorar resultados. As 8 hipóteses de um só parâmetro (stop móvel 4×, EMA 100, rompimento 40, stop 3×; sem alvo, alvo 2×, stop 3×, rompimento 40) foram testadas no protocolo em 3 partes: nos dados longos nenhuma do Day trade nem do Swing 4h foi promissora. As três que cumpriram a regra (rompimento de 40 velas no Day trade 4h e no Swing 4h da Hyperliquid, e no Swing 1d) não se confirmaram no teste final, exceto a do Swing 1d, que não difere da referência: Day trade HL −0,27 R (10 trades), Swing 4h HL −0,32 R (7 trades), Swing 1d +0,83 R (20 trades, IC [−0,02; +1,82], t 1,53; a referência deu +0,75 R). Os parâmetros por omissão ficam como estão.

**6. Há expectativa positiva fora da amostra?** Só o **Swing em velas diárias** aponta para cima, sem prova: 88 trades (ouro e EUR/USD, 2020–2026), +0,17 R por trade, fator 1,37, +14,3 %, queda 13,2 %; por partes: desenvolvimento −0,21 R (43 trades), validação +0,26 R (21), teste final +0,75 R [+0,05; +1,52] (24 trades, t = 1,47, abaixo do 2,58 exigido com 5 variantes). Teste em duas partes da app: 2.ª parte +0,74 R, t = 2,03 (precisa 2,5): **não passa**. Sobre a amostra inteira t = 0,94 e o IC [−0,13; +0,50] inclui zero. Todo o ganho vem do ouro (+$1 434, +0,26 R; EUR/USD +0,01 R) e 6 trades de longa duração dão $902 dos $1 433; o ouro subiu +112 % no período (comprar e manter bate o swing por larga margem). O padrão (negativo no 1.º período, positivo depois) é compatível com «seguir uma alta forte do ouro», não com vantagem independente do regime.

**7. Sobreajuste e limitações:** foram corridos 8 estudos × várias hipóteses; o melhor foi escolhido depois de ver todos, por isso o seu resultado deve ser lido com desconto. Amostras pequenas (Day trade 1h: 11 trades). Proxies (PAXG, EURUSDT) com custos supostos iguais aos da Hyperliquid. Funding real só em parte das horas (≈28 % nos 303 dias da Hyperliquid) e ausente na Binance. S&P 500 só tem 6–7 trades. Não há spread/profundidade de livro nem tamanho mínimo de ordem da Hyperliquid no modelo (com $10 reais pode nem ser possível abrir a posição calculada).

**8. Testes adicionais necessários:** (a) medir a taxa real e o slippage real na Hyperliquid em testnet/conta demo com ordens pequenas (o worker já regista); (b) repetir o Swing diário em mais instrumentos, com a hipótese fixada **antes** de olhar (ouro, índices), para separar vantagem de tendência do ouro; (c) papel em tempo real durante meses, só com o Swing diário, sem alterar regras; (d) simular o tamanho mínimo de ordem e arredondamentos de `szDecimals`.

**9. Estado de cada estratégia**

| Estratégia | Estado | Evidência |
|---|---|---|
| Rompimento 15 min | **não validada** | 0 trades (filtro de custo); sem filtro −90 %; a 2 bps −20,7 % |
| Day trade 4h / 1h | **não validada**, evidência contra | 303 d: −0,02 R (t −0,21); 6,8 anos: −0,15 R, t −3,76 |
| Swing 4h | **não validada** | 303 d: +0,01 R (t 0,03); 6,8 anos: −0,16 R (t −1,77) |
| Swing 1d | **em investigação** | +0,17 R mas IC inclui 0, t 0,94; não passa o teste (t 2,03 < 2,5) |
| Reversão, tendência, stop móvel, RSI 2, scalping | não validadas (auditoria §8, §11) | sem vantagem após custos |

Nenhuma está pronta para conta demo de execução, e nenhuma deve operar com dinheiro real. O **Swing diário** é a única que merece seguir em papel, sem mexer nas regras.

### 13.3 Dados
Qualidade verificada por mercado: velas fora de ordem 0, duplicadas 0, inválidas 0; uma lacuna de 2 velas no EURUSDT 4h. A Hyperliquid devolve só 1 301–1 817 velas de 4h (os mercados `xyz:` existem desde dezembro de 2025 / março de 2026), por isso os 303 dias são o máximo disponível.

## 14. Laboratório de estratégias (2026-10-21)
Pesquisa de fontes (`docs/PESQUISA-ESTRATEGIAS.md`), biblioteca de 29 famílias e laboratório em lote com testes múltiplos e controlo negativo (`docs/LABORATORIO.md`, `docs/LABORATORIO-RESULTADOS.md`). Resultado: 1 655 configurações, 3 905 simulações, **nenhuma aprovada**; os dados reais não se distinguem do controlo; o teste final não foi usado.

