# Proxy de holders (Helius) para o DOLLOS Trade Bot

O site é estático e público, por isso a chave da Helius não pode estar no JavaScript.
Este Cloudflare Worker guarda a chave como segredo e expõe só `GET /holders?mint=<mint Solana>`.

## Deploy (só holders; o jeito novo é o do fim deste ficheiro)
1. Cria uma chave gratuita em https://dashboard.helius.dev
2. `cd worker && npx wrangler login`
3. `npx wrangler secret put HELIUS_API_KEY`   (cola a chave)
4. Confirma `ALLOWED_ORIGIN` em `wrangler.toml` (o domínio do teu site) e corre `npx wrangler deploy`
5. Abre o site com `https://jbx19t.github.io/grokbot/?holders=https://grokbot-holders.<teu-user>.workers.dev`

## O que devolve
`topWallet` e `top10` (fração da supply, **sem** pools/curvas/contas de programa), `mintAuthority`, `freezeAuthority`.
Se o mint ou a freeze authority estiverem ativos, o Vet faz `trade_kill`. Resultados em cache 5 min.
Só Solana. Não calcula `dev_still_loaded` nem `recycled_account` (continuam n/a).

## Execução real: Hyperliquid (ouro, S&P, EUR/USD) e Solana (memecoins)
**Tudo vem desligado e em simulação.** A app diz o que o desk quer ter; o worker decide e executa com limites próprios.
O código só envia ordens se *tu* ativares `HL_LIVE=1` / `SOL_LIVE=1` no Cloudflare. Sem isso, as rotas calculam e devolvem o plano, nada mais.

### 1. Publicar o worker novo (uma vez)
O worker agora usa bibliotecas, por isso já não se cola à mão no Cloudflare: o GitHub publica-o sozinho.
1. Cloudflare → *My Profile* → *API Tokens* → *Create Token* → modelo **Edit Cloudflare Workers** → cria e copia o token.
2. Cloudflare → *Workers & Pages* → copia o **Account ID**.
3. GitHub → o repositório → *Settings* → *Secrets and variables* → *Actions* → cria `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
4. GitHub → *Actions* → **Worker (testes e deploy)** → *Run workflow*. Corre os testes e publica. Os segredos que já tens no Cloudflare (Helius) mantêm-se.

### 2. Segredos e variáveis no Cloudflare (Workers → o teu worker → Settings → Variables and Secrets)
| Nome | Tipo | Para quê |
|---|---|---|
| `APP_TOKEN` | segredo | palavra-passe comprida que inventas; é o que a app usa para falar com o worker |
| `HL_AGENT_KEY` | segredo | chave privada da **carteira de API** da Hyperliquid (0x + 64 hex) |
| `HL_ACCOUNT` | segredo | endereço da tua conta principal na Hyperliquid (0x…) |
| `SOL_KEY` | segredo | chave da carteira Solana **dedicada** (a que a Phantom exporta) |
| `HL_LIVE` / `SOL_LIVE` | variável | `1` para enviar ordens. **Não existindo, é simulação.** |
| `HL_NETWORK` | variável | `testnet` (omissão) ou `mainnet`. Mainnet exige ainda `HL_CONFIRM_MAINNET=YES` |
| `HL_PAUSED` / `SOL_PAUSED` | variável | `1` bloqueia aberturas (continua a fechar) |
| `HL_MAX_ORDER_USD` 15, `HL_MAX_GROSS_USD` 30, `HL_MIN_ORDER_USD` 10, `HL_LEVERAGE` 3, `HL_SLIPPAGE_BPS` 50 | variável | limites da Hyperliquid (valores por omissão) |
| `HL_DEXES` (xyz), `HL_MARKETS` | variável | onde procurar os mercados e, se preciso, os nomes exatos, por ex. `{"GOLD":"xyz:GOLD"}` |
| `SOL_TICKET_USD` 2, `SOL_MAX_TICKET_USD` 5, `SOL_MAX_OPEN` 3, `SOL_SLIPPAGE_BPS` 300, `SOL_SELL_MAX_IMPACT` 20 | variável | limites da Solana |
| `NTFY_TOPIC` | segredo | nome do tópico das notificações (ver ponto 6) |
| `HL_GUARD_DD` 0.2 | variável | proteção do servidor: queda desde o máximo que fecha tudo na Hyperliquid |
| `SOL_GUARD_SL` 0.3, `SOL_GUARD_TP` 1, `SOL_GUARD_MAX_HOURS` 6, `SOL_STALE_MIN` 30 | variável | proteção do servidor nas memecoins (0 em `SOL_STALE_MIN` desliga a venda por app parada) |
| `HL_AUTOPILOT` | variável | `1` liga o piloto automático no servidor (ver ponto 7). Desligado por omissão |
| `HL_STRATEGY` breakout, `HL_INTERVAL` 15m | variável | estratégia (`breakout`, `reversion`, `trend`) e velas (`15m`, `1h`, `4h`) do piloto |
| `HL_TP_TRIGGER` | variável | `1` volta ao alvo a mercado (por omissão o alvo é uma ordem limitada, com taxa de maker) |

### 3. Hyperliquid
- A **carteira de API** só assina ordens; não levanta fundos. Na Hyperliquid: menu → *API* → dá-lhe um nome → *Generate* → *Authorize*. A chave aparece **uma vez**: cola-a direto no segredo `HL_AGENT_KEY`. Nunca a mandes a ninguém.
- Os mercados de ouro e S&P estão nos mercados "HIP-3" (builder `xyz`). A conta precisa de USDC nesse dex; se a app mostrar *sem saldo na conta*, transfere USDC para o dex na interface da Hyperliquid.
- Cada entrada leva stop e alvo **na própria Hyperliquid**, ambos reduce-only: o stop é uma ordem de gatilho a mercado; o alvo é uma ordem limitada (fica no livro e paga a taxa de maker, mais baixa). Se o stop não for aceite, o worker fecha a posição logo.
- O worker gere as posições nesses três mercados: se abrires à mão uma posição em ouro, S&P ou EUR/USD nessa conta, ele fecha-a quando o desk não a quiser.
- Começa em `testnet`: precisas de uma conta de teste em app.hyperliquid-testnet.xyz.

### 4. Solana (memecoins)
- Cria uma **carteira nova só para isto** (nunca a tua principal). Põe lá uns poucos USDC e ~0,02 SOL para taxas. Exporta a chave privada e cola-a em `SOL_KEY`.
- Compra e venda pela Jupiter, em USDC. Com a app aberta, as saídas seguem o desk; com a app fechada, atua a proteção do servidor (ponto 6).
- O worker trata a carteira como sua: **vende tudo o que não for USDC ou SOL** e que o desk não queira. Por isso é uma carteira dedicada.

### 5. Ligar na app
No site/app, painéis **HYPERLIQUID · LIVE** e **SOLANA · LIVE**: cola o `APP_TOKEN` e toca **LIGAR**. Primeiro vês só o plano (simulação). **FECHAR TUDO** fecha tudo de imediato.

### 6. Proteção do servidor e notificações
O worker corre sozinho **a cada 5 minutos**, mesmo com a app fechada (cron da Cloudflare + uma pequena memória, um Durable Object incluído no plano grátis). **Só fecha e vende; nunca abre nada.**
- **Hyperliquid:** guarda o saldo máximo. Se o saldo cair 20% (`HL_GUARD_DD`), fecha tudo e não deixa abrir mais até tocares **RETOMAR** no painel. Se só levantaste dinheiro, toca também em RETOMAR.
- **Memecoins:** vende uma memecoin se cair 30% face à entrada, se subir 100%, ou se estiver há mais de 6 h na carteira. Se a app ficar **30 min sem sincronizar** (fechada ou suspensa pelo telemóvel), vende tudo. O que a proteção vende não volta a ser comprado durante 6 h.
- Em simulação não envia nada: só avisa o que faria.
- **Notificações no telemóvel:** instala a app **ntfy** (Android ou iPhone, grátis, sem conta) → *+* → subscreve um tópico com um nome comprido e difícil de adivinhar (por ex. `dollos-` + letras e números ao calhas). Guarda o mesmo nome no segredo `NTFY_TOPIC` do worker. No painel, **TESTAR NOTIFICAÇÃO** confirma. Recebes um aviso a cada ordem real, a cada falha e a cada ação da proteção. Quem souber o nome do tópico lê os avisos, por isso trata-o como uma palavra-passe.

### 7. Piloto automático no servidor (opcional, desligado)
Com `HL_AUTOPILOT=1`, o próprio worker corre a estratégia (as mesmas regras do desk e do teste histórico, `grokbot/strategy.js`) sobre as velas da Hyperliquid e decide as posições, mesmo com a app fechada. A app deixa de decidir a Hyperliquid e passa a mostrar o que o piloto fez. Continua sujeito a `HL_LIVE`, `HL_NETWORK`, aos limites e à proteção. **Só faz sentido ligá-lo com uma estratégia que tenha passado o teste em duas partes do TESTE HISTÓRICO** e depois de semanas em papel.

### Travões, por ordem
1. App: *FECHAR TUDO* ou *DESLIGAR*.  2. Cloudflare: `HL_PAUSED=1` / `SOL_PAUSED=1`.  3. Apagar `HL_LIVE` / `SOL_LIVE` (e `HL_AUTOPILOT`).  4. Apagar os segredos de chave.  A proteção do servidor (ponto 6) atua por si.

### O que está verificado e o que não está
- **Verificado em testes:** proteção do servidor (paragem de -20%, stops/alvos/tempo das memecoins, venda por app parada, bloqueio de recompra), piloto automático (sinal, vela aberta ignorada, limite de tempo), notificações; assinatura das ordens da Hyperliquid igual, byte a byte, à do SDK oficial em Python; assinatura de transações Solana igual à do PyNaCl; fluxos com Hyperliquid e Jupiter simulados (limites, mínimos, stops recusados, fechar, emergência).
- **Não verificado (sem rede aqui):** respostas reais da Hyperliquid, da Jupiter e do RPC; nomes exatos dos mercados de ouro, S&P e EUR/USD; mínimo por ordem; comportamento do saldo por dex. **A primeira ordem a sério é um teste contigo, na rede de teste.**
- **Riscos que ficam:** a chave da carteira Solana vive no Cloudflare (por isso carteira dedicada, com pouco); a Jupiter devolve a transação já montada e o worker só confirma que o pagador é a tua carteira; memecoins podem não ter saída.
