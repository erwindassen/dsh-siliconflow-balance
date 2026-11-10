# dsh-siliconflow-balance

A DeepSeek Harness plugin for **DSH Desktop and DSH Web** that shows your SiliconFlow
credit balance in the composer dock — directly under the prompt input, next to the
token-usage pill.

> **Status:** design approved, repository scaffolded, implementation not started.
> The full research and design document is [docs/design.md](docs/design.md).

## What it will do

- A small pill in `conversation.composer.dock` showing `¥<totalBalance>` (CNY, two decimals).
- Click it for a breakdown popover: granted credit (`balance`), topped-up credit
  (`chargeBalance`), total (`totalBalance`), and the time of the last refresh.
- Turns amber when the total drops below `warnThreshold` (default ¥10).
- Refreshes every 5 minutes while the page is visible, pauses while hidden, and
  revalidates on focus. The API key never reaches the browser: the Host owns the call
  and the cache, and the page only receives the formatted numbers.

## Requirements

- DSH Desktop 0.2.2-rc.1+ or `dsh web` (same client bundle serves both).
- A SiliconFlow API key stored in DSH credentials under the ref `SILICONFLOW_API_KEY`
  (the same ref the `llm-pi-ai` provider already uses). Nothing new to provision.

## Layout

```
src/index.ts     Host half: config, route, credential resolution, cache
src/balance.ts   Pure parse/format helpers (unit-tested)
src/client.tsx   Browser half: dock registration, pill, popover
src/types.ts     Shared wire payload types
docs/design.md   Research, decisions, ADR, implementation plan
```

## Development

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm build        # emits lib/index.js (Host) and the wrapped lib/client.js
```

`pnpm build:client` builds the browser half with tsdown and wraps it in the
`window.__ModuleLoader__.load({ id, factory })` contract (`scripts/wrap-client-bundle.mjs`).

## Installing into a profile

Build first, then install the absolute package directory into each profile with
`plugin_manager` `install_bundle`:

```text
plugin_manager({ action: "install_bundle", target: "/Users/erwindassen/Projects/dsh-siliconflow-balance" })
```

Repeat for the `desktop` and `web` profiles. Reload the page afterwards; the pill appears
right of the token-usage pill inside the conversation composer.

## Configuration

Set on the plugin's Loader row (config-only for v1):

| key | default | meaning |
| --- | --- | --- |
| `baseUrl` | `https://api.siliconflow.com/v1` | Vendor base URL (`https://api.siliconflow.cn/v1` for the CN site) |
| `credentialRef` | `SILICONFLOW_API_KEY` | Credential ref resolved through `ctx.credentials` |
| `refreshSeconds` | `300` | Client refresh interval while visible |
| `showBreakdown` | `true` | Show the popover breakdown |
| `warnThreshold` | `10` | CNY threshold for the amber pill; `0` disables |

## License

MIT © Erwin Dassen
