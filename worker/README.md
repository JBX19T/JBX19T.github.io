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
| `SOL_TICKET_USD` 2, `SOL_MAX_TICKET_USD` 5, `SOL_MAX_OPEN` 3, `SOL_SLIPPAGE_BPS` 300 | variável | limites da Solana |

### 3. Hyperliquid
- A **carteira de API** só assina ordens; não levanta fundos. Na Hyperliquid: menu → *API* → dá-lhe um nome → *Generate* → *Authorize*. A chave aparece **uma vez**: cola-a direto no segredo `HL_AGENT_KEY`. Nunca a mandes a ninguém.
- Os mercados de ouro e S&P estão nos mercados "HIP-3" (builder `xyz`). A conta precisa de USDC nesse dex; se a app mostrar *sem saldo na conta*, transfere USDC para o dex na interface da Hyperliquid.
- Cada entrada leva stop e alvo **na própria Hyperliquid** (ordens de gatilho reduce-only). Se o stop não for aceite, o worker fecha a posição logo.
- O worker gere as posições nesses três mercados: se abrires à mão uma posição em ouro, S&P ou EUR/USD nessa conta, ele fecha-a quando o desk não a quiser.
- Começa em `testnet`: precisas de uma conta de teste em app.hyperliquid-testnet.xyz.

### 4. Solana (memecoins)
- Cria uma **carteira nova só para isto** (nunca a tua principal). Põe lá uns poucos USDC e ~0,02 SOL para taxas. Exporta a chave privada e cola-a em `SOL_KEY`.
- Compra e venda pela Jupiter, em USDC. As saídas só acontecem com a app aberta.
- O worker trata a carteira como sua: **vende tudo o que não for USDC ou SOL** e que o desk não queira. Por isso é uma carteira dedicada.

### 5. Ligar na app
No site/app, painéis **HYPERLIQUID · LIVE** e **SOLANA · LIVE**: cola o `APP_TOKEN` e toca **LIGAR**. Primeiro vês só o plano (simulação). **FECHAR TUDO** fecha tudo de imediato.

### Travões, por ordem
1. App: *FECHAR TUDO* ou *DESLIGAR*.  2. Cloudflare: `HL_PAUSED=1` / `SOL_PAUSED=1`.  3. Apagar `HL_LIVE` / `SOL_LIVE`.  4. Apagar os segredos de chave.

### O que está verificado e o que não está
- **Verificado em testes:** assinatura das ordens da Hyperliquid igual, byte a byte, à do SDK oficial em Python; assinatura de transações Solana igual à do PyNaCl; fluxos com Hyperliquid e Jupiter simulados (limites, mínimos, stops recusados, fechar, emergência).
- **Não verificado (sem rede aqui):** respostas reais da Hyperliquid, da Jupiter e do RPC; nomes exatos dos mercados de ouro, S&P e EUR/USD; mínimo por ordem; comportamento do saldo por dex. **A primeira ordem a sério é um teste contigo, na rede de teste.**
- **Riscos que ficam:** a chave da carteira Solana vive no Cloudflare (por isso carteira dedicada, com pouco); a Jupiter devolve a transação já montada e o worker só confirma que o pagador é a tua carteira; memecoins podem não ter saída.
