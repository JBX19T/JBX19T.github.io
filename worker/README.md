# Proxy de holders (Helius) para o DOLLOS Trade Bot

O site é estático e público, por isso a chave da Helius não pode estar no JavaScript.
Este Cloudflare Worker guarda a chave como segredo e expõe só `GET /holders?mint=<mint Solana>`.

## Deploy
1. Cria uma chave gratuita em https://dashboard.helius.dev
2. `cd worker && npx wrangler login`
3. `npx wrangler secret put HELIUS_API_KEY`   (cola a chave)
4. Confirma `ALLOWED_ORIGIN` em `wrangler.toml` (o domínio do teu site) e corre `npx wrangler deploy`
5. Abre o site com `https://jbx19t.github.io/grokbot/?holders=https://grokbot-holders.<teu-user>.workers.dev`

## O que devolve
`topWallet` e `top10` (fração da supply, **sem** pools/curvas/contas de programa), `mintAuthority`, `freezeAuthority`.
Se o mint ou a freeze authority estiverem ativos, o Vet faz `trade_kill`. Resultados em cache 5 min.
Só Solana. Não calcula `dev_still_loaded` nem `recycled_account` (continuam n/a).

## Alpaca (paper trading)
O mesmo worker espelha as posições do Macro Desk numa conta de **paper** da Alpaca (dinheiro fictício, mas ordens reais num simulador a sério).
Ouro → `GLD`, EUR/USD → `FXE`, S&P 500 → `SPY` (ETFs; a Alpaca não tem os perpétuos do Lighter).

1. Cria conta em https://alpaca.markets, abre **Paper Trading** e gera uma chave (API Key + Secret).
2. No Cloudflare (Workers → o teu worker → Settings → Variables and Secrets) acrescenta três **segredos**:
   `ALPACA_KEY`, `ALPACA_SECRET` e `APP_TOKEN` (inventa uma palavra-passe comprida; é o que a app vai usar para falar com o worker).
3. Substitui o código do worker pelo conteúdo atual de `worker/holders.mjs` e faz **Deploy**.
4. Na app, no painel do Macro Desk, cola o `APP_TOKEN` em *ALPACA · PAPER* e toca **LIGAR**.

Segurança: os endereços da Alpaca estão fixos em **paper** no código (não há caminho para a conta real), só `SPY/GLD/FXE`,
máximo 5000 $ por ordem, e toda a chamada exige o `X-Token`. Só envia ordens com a bolsa dos EUA aberta.
Para usar dinheiro real seria preciso alterar o código de propósito; não está previsto.
