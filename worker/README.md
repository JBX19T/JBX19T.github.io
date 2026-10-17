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
