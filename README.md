# dsh-siliconflow-balance

A [DeepSeek Harness](https://github.com/deepseek-ai) plugin: your SiliconFlow **console** balance,
as a small `¥` pill below the composer.

## Why it reads the console

SiliconFlow retired the API-key balance endpoint (`GET /v1/user/info`) on 2026-08-14 — it now
answers `410` / `code: 20092`, while `/v1/models` still works with the same key. The account
balance is still visible in the console, and the console gets it from its own wallet service:

```
GET https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek
Cookie: …            ← the signed-in console session
x-subject-id: …      ← the account short id
```

Those two values come from your browser session, not from an API key. So this plugin stores them
once (in the DSH **credential store**, not in plugin config) and lets the Host poll the wallet
service for you. The browser never sees the cookie, and the browser never calls SiliconFlow.

## Install

```bash
plugin_manager({ action: "install_bundle", target: "github:erwindassen/dsh-siliconflow-balance#v0.3.0" })
```

Pin a tag so a later push cannot change what runs. The package ships its `lib/` build, so a git
install needs no toolchain. After installing, restart DeepSeek Harness if the plugin manager asks
for it.

## Set it up (once)

1. Open **Settings** and pick **SiliconFlow balance** in the sidebar.
2. Press **Open the console page** — it opens
   `https://cloud.siliconflow.com/me/expensebill` in your default browser.
3. In the browser dev tools → **Network**, reload, and find the request named `peek` (or filter for
   `walletd-server`).
4. Copy the whole **Cookie** request header into the first field, and the **x-subject-id** request
   header value into the second. Press **Validate and save**.
5. The section reports the live balance; the composer pill fills in on the next poll.

The plugin validates the session against the console before saving it, so a bad paste is rejected
with a message instead of silently replacing a working one.

## What you see

- `¥906.70` in the composer dock, right after the token-usage pill.
- Amber when the available balance drops below `warnThreshold` (default `¥10`).
- Click the pill for **Available / Topped up / Used**, the reading time, and a **Refresh now** action.
- `Balance —` until a session is saved; if the session expires the pill turns red-ish and the
  popover says to paste a fresh cookie.

Amounts in the wallet response are integer strings in **nano-yuan** (`1e-9` CNY), so
`906696398000` is `¥906.696398` and is shown rounded to `¥906.70`. `available + used = recharged`
holds for the sample account.

## Configuration

The Loader row config is the plugin's settings form (rendered by DSH from a schemastery schema):

| key | default | meaning |
| --- | --- | --- |
| `consoleBaseUrl` | `https://cloud.siliconflow.com` | Console origin the Host calls |
| `cookieRef` | `SILICONFLOW_CONSOLE_COOKIE` | Credential ref holding the pasted Cookie header |
| `subjectRef` | `SILICONFLOW_CONSOLE_SUBJECT` | Credential ref holding the pasted subject id |
| `refreshSeconds` | `300` | Pill poll interval while the window is visible (clamped to 30–3600) |
| `showBreakdown` | `true` | Show the three amounts in the popover |
| `warnThreshold` | `10` | Amber below this many CNY; `0` disables the warning |

The two credential refs are patch-level configuration; normally you never touch them.

## How it works

```
Browser (client.tsx)                       Host (index.ts)
  GET  /api/siliconflow.balance      →      cached sample? → credentials.resolve(cookie/subject)
  POST /api/siliconflow.balance/session →   validate session, then credentials.set(...)
  POST /api/siliconflow.balance/clear    →  credentials.unset(...)
                                            └→ GET walletd-server/…/peek (redirect: 'manual')
```

- Every route answers HTTP 200 with `{ok, reason?, configured, amounts?, asOf?, policy, consoleUrl}`;
  failures are data, never a 5xx, so the pill never breaks the composer.
- One request in flight at a time; concurrent polls share it. The Host caches a sample for
  `min(refreshSeconds / 2, 60)` seconds; the pill drops ticks while the document is hidden.
- A login redirect (307) or 401/403 is reported as `unauthorized` — the session expired — and the
  pill retries every 30 minutes instead of every `refreshSeconds`.
- The old API-key path is gone; `retired` still exists in the failure taxonomy for a 410 answer.

## Security

- The cookie and subject id live in `~/.dsh/.credentials.yaml` via the `credentials` service; the
  settings form only ever writes them.
- No route returns either value. The payload carries only amounts, timestamps, and policy.
- Only the Host process talks to SiliconFlow; the browser bundle never imports an HTTP client.
- `redirect: 'manual'` prevents a login page from being parsed as a balance reading.
- Copying a session cookie is like copying a login: treat it as a secret. **Forget session** wipes
  both values.

## Limits

- Console routes are not a public API contract; SiliconFlow can rename or move
  `walletd-server/…/peek`. If that happens the pill reports an upstream failure instead of a fake
  number. Update `src/balance.ts` and the parse path, or open an issue.
- There is no refresh token: when the console session expires you paste a fresh cookie (about as
  often as the console itself logs you out).
- The subject id is per account; switching SiliconFlow accounts means pasting again.

## Layout

```
src/index.ts      Host half: config schema, three routes, cache, console call
src/balance.ts    Wire parsing: nano-yuan → CNY, URL joining, formatting
src/client.tsx    Browser half: composer pill, popover, settings section, styles
src/types.ts      Shared payload types
locale/{en,zh}.json  Plugin card metadata
test/             vitest: parser, Host routes, jsdom render, slot registration
```

## Development

```bash
pnpm install
pnpm run check   # typecheck + tests + build
pnpm run build   # lib/index.js (Host) and lib/client.js (loader-wrapped browser bundle)
```

Install from the checkout while developing:

```bash
plugin_manager({ action: "install_bundle", target: "/absolute/path/to/dsh-siliconflow-balance" })
```

Note that the profile then holds a copy of the package; reinstall after changing the source.

## Verification

- `pnpm run check`: typecheck, 62 vitest tests across 4 files, and a clean build.
- Live: the pill and the settings section register in a running DSH Desktop profile
  (`conversation.composer.dock` occupant `siliconflow-balance`, order 2, after the usage pill).
- Not verified: pixel-level styling against the shipped composer; a real session against a real
  console response end-to-end (the wire shape came from a Safari capture, and the tests replay it).

MIT © Erwin Dassen
