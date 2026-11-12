# dsh-siliconflow-balance

A DeepSeek Harness plugin for **DSH Desktop and DSH Web** that shows your SiliconFlow
credit balance in the composer dock — directly under the prompt input, next to the
token-usage pill.

> **Status:** implemented and verified in DSH Desktop. Design and research live in
> [docs/design.md](docs/design.md).

## What it does

- A small pill in `conversation.composer.dock` showing `¥<totalBalance>` (CNY, two decimals).
- Click it for a breakdown popover: granted credit (`balance`), topped-up credit
  (`chargeBalance`), total (`totalBalance`), and the time of the last refresh.
- Turns amber when the total drops below `warnThreshold` (default ¥10).
- Refreshes every 5 minutes while the page is visible, pauses while hidden, and
  revalidates on focus. The API key never reaches the browser: the Host owns the call
  and the cache, and the page only receives the formatted numbers.

## Requirements

- DSH Desktop 0.2.2-rc.1+ or `dsh web` (the same client bundle serves both).
- A SiliconFlow API key stored in DSH credentials under the ref `SILICONFLOW_API_KEY`
  (the same ref the `llm-pi-ai` provider already uses). Nothing new to provision.

## Install

The repository ships its build output (`lib/`), so installing needs no toolchain and no
build step.

**From GitHub, into one profile** (repeat for `desktop` and `web`):

```text
plugin_manager({ action: "install_bundle", target: "github:erwindassen/dsh-siliconflow-balance" })
```

Pin a release instead of the default branch by appending a ref, e.g.
`github:erwindassen/dsh-siliconflow-balance#v0.1.0`. Keep `lib/` committed and rebuilt
before tagging — the git install runs no build script.

**From a local checkout** (what this repository was verified against):

```text
plugin_manager({ action: "install_bundle", target: "/absolute/path/to/dsh-siliconflow-balance" })
```

Reload the page afterwards; the pill appears right of the token-usage pill inside the
conversation composer. Hover the pill for the accessible label, click it for the
breakdown.

## Configuration

Set on the plugin's Loader row (config-only for v1):

| key | default | meaning |
| --- | --- | --- |
| `baseUrl` | `https://api.siliconflow.com/v1` | Vendor base URL (`https://api.siliconflow.cn/v1` for the CN site) |
| `credentialRef` | `SILICONFLOW_API_KEY` | Credential ref resolved through `ctx.credentials` |
| `refreshSeconds` | `300` | Client refresh interval while visible (clamped to 30–3600) |
| `showBreakdown` | `true` | Show the popover breakdown |
| `warnThreshold` | `10` | CNY threshold for the amber pill; `0` disables |

## How it works

```
browser  ──GET /api/siliconflow.balance──▶  Host  ──Bearer key──▶  api.siliconflow.com
   pill  ◀── { ok, amounts, asOf, policy } ──        (cache ≤60 s, single flight)
```

- `src/index.ts` — Host half: schemastery config, credential resolution, upstream call,
  ≤60 s sample cache shared by concurrent requests, and the same-origin route. Failures
  are always HTTP 200 with `{ ok: false, reason }`, where `reason` is one of
  `unconfigured`, `unauthorized`, `upstream`, `invalid-response`; the composer never sees
  an error state from a network problem.
- `src/balance.ts` — pure envelope parsing and CNY formatting (unit-tested).
- `src/client.tsx` — browser half: registers the dock entry, renders the pill, and portals
  the popover to `document.body` because the docked composer clips overlays.

## Layout

```
src/index.ts     Host half: config, route, credential resolution, cache
src/balance.ts   Pure parse/format helpers (unit-tested)
src/client.tsx   Browser half: dock registration, pill, popover
src/types.ts     Shared wire payload types
test/            vitest: envelope parsing, formatting, Host route, and the jsdom render
docs/design.md   Research, decisions, ADR, implementation plan
```

## Verification

Checked against a live DSH Desktop profile (0.2.2-rc.1):

- `pnpm run check` — TypeScript (Host + client), 36 vitest tests, and the build are green.
- `install_bundle` with the local path applied the bundle to the profile; the Loader row
  `siliconflow-balance` reports status `schema`.
- The client bundle registered its dictionaries and the dock entry
  `{ registrant: "dsh-siliconflow-balance", id: "siliconflow-balance", order: 2, active: true }`
  in `conversation.composer.dock` on the running page.
- The jsdom suite mounts the real component: states `loading`/`ok`/`low`/`stale`/
  `unconfigured`, `aria-expanded` on a real `<button>`, the portaled popover, Escape and
  outside-click dismissal, the hidden-document pause, and the "no reading yet" failure note.

Not verified here: pixel-level styling in a screenshot, and the balance shown against a
real SiliconFlow key — this machine has no `SILICONFLOW_API_KEY` configured, so the live pill
renders the `unconfigured` state until a key exists.

## Development

```bash
pnpm install
pnpm run typecheck   # Host + client TypeScript
pnpm test            # vitest
pnpm run build       # emits lib/index.js (Host) and the wrapped lib/client.js
pnpm run check       # typecheck + test + build
```

`pnpm build:client` builds the browser half with tsdown and wraps it in the
`window.__ModuleLoader__.load({ id, factory })` contract
(`scripts/wrap-client-bundle.mjs`). React and React DOM are platform modules of the DSH
page and stay external.

## License

MIT © Erwin Dassen
