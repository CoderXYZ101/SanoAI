# SanoAI AI: give every user Claude, without giving anyone the key

Users choose **SanoAI AI** or **Built-in rules**. The Claude key lives only in a small proxy on Cloudflare (free plan).
It is never in the website, in this folder or on GitHub.

> **Never paste the key into any project file or a chat.** You type it once, at the prompt in step 4.

## Cost (billed to the owner of the key)
| Model (`ANTHROPIC_MODEL` in `billing/managed-ai-worker/wrangler.toml`) | Price per million tokens, in / out | Worst case per free user per month* |
|---|---|---|
| `claude-opus-5-5` (current setting, strongest) | $4 / $20 | about $32 plus input |
| `claude-haiku-5-5` (much cheaper) | $0.10 / $0.50 | under $1 plus input |

\* 100 requests that each use the full 16,000-token ceiling. Normal answers are far shorter. Check current prices, and
**set a monthly spend limit at https://console.anthropic.com** before sharing the site.

## Set it up (PowerShell on your PC)
1. Create a free account at https://dash.cloudflare.com/sign-up
2. Prepare the terminal (run in this same window for steps 3 and 4):
   ```powershell
   cd G:\SanoAI; $env:Path = "$env:APPDATA\fnm\node-versions\v22.23.5\installation;$env:Path"; $env:npm_config_cache = "G:\npm-cache"
   ```
3. Log in, then publish the proxy. Copy the address it prints (`https://sanoai-ai.<your-name>.workers.dev`):
   ```powershell
   npx wrangler login
   ```
   ```powershell
   npx wrangler deploy --config billing/managed-ai-worker/wrangler.toml
   ```
4. Add the Claude key. Paste it when asked:
   ```powershell
   npx wrangler secret put ANTHROPIC_API_KEY --config billing/managed-ai-worker/wrangler.toml
   ```
5. In `.env.production`, set the line to your proxy address (remove the `#`):
   ```
   NEXT_PUBLIC_MANAGED_AI_URL=https://sanoai-ai.<your-name>.workers.dev
   ```
6. Commit and push, then in your Codespace run `git pull`, `npm ci` and `npm run deploy`.
   This also publishes the new security rules the allowance counter needs.

## What users get
- A one-time question: **SanoAI AI** or **Built-in rules**. Changeable in Settings.
- Monthly requests: Free 100, Plus 500, Pro 1,500 (keep `LIMITS` in the proxy and `src/lib/billing.ts` the same).
- If the AI is unavailable or the allowance is used up, built-in rules answer instead.
- Optional: people running Ollama can use it under **Settings → Advanced**. It is tried first.

## Other providers
The same proxy also accepts `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY` and `DEEPSEEK_API_KEY` secrets as
backups, tried in that order after Claude.

## Not tested
The proxy is tested locally with simulated providers (`npm run test:ai`). It has not yet been deployed to Cloudflare or
called with a real Claude key.
