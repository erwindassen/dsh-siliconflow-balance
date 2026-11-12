# dsh-siliconflow-balance — research & design

Status: **approved 2026-11-10** (decisions in §7); repository scaffolded, implementation not started
Target: DSH Desktop 0.2.2-rc.1 + DSH Web (`dsh web`)

Scope: one composer-dock pill showing the SiliconFlow account balance, next to the existing
token-usage pill, in both Desktop and Web.

Evidence base: the DSH implementation checkout at
`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/` (asar), the installed
profiles under `/Users/erwindassen/.dsh/profiles/{desktop,web}/`, and two real third-party
plugins (`dsh-prompt-rewriter`, `dsh-context`) plus one first-party client plugin
(`@deepseek-ai/dsh-client-ui-chat`) as reference implementations.

---

## 1. How a client UI plugin contributes a widget under the composer

### 1.1 The slot

The token-statistics pill under the prompt input is a **list entry** of the slot
`conversation.composer.dock`.

- Slot owner: `@deepseek-ai/dsh-client-ui-conversation`
  (`lib/client.js`, in its `conversation.composer.bar` registration):

  ```js
  "conversation.composer.bar": {
    children: {
      /* … */
      "conversation.composer.dock": { kind: "list", scope: "session" }
    }
  }
  ```

- Render position: the same file renders the composer as

  ```js
  jsxs("div", {
    className: InputBar_module_css_default.dock,
    "data-composer-dock": true,
    children: [
      variant === "composer" && input !== void 0 && sessionId !== void 0
        ? renderSlot("conversation.composer.dock", {})
        : null,
      activity ? null : jsx(ContextMeter, { useProjection, t })
    ]
  })
  ```

  i.e. dock entries render **inside the dock row directly below the input card**, before the
  context-occupancy meter. Consequence: entries render only for the `composer` variant with a
  live session — **not** on the Hero / empty-conversation composer.

- Slot entries: `@deepseek-ai/dsh-client-ui-chat` (`lib/client.js`) registers the two that exist:

  ```js
  const statPillInject = () => ({ hooks: { performanceUsage } });
  ctx.slots.inject("conversation.composer.dock", function* () {
    yield ctx.slots.register(
      { name: "conversation.composer.dock", id: "activity", order: 0, locale: NS, inject: statPillInject },
      ActivityPill);
    yield ctx.slots.register(
      { name: "conversation.composer.dock", id: "usage", order: 1, locale: NS, inject: statPillInject },
      UsagePill);
  });
  ```

  `dsh-client-ui-chat/README.md:79` states the ownership rule verbatim: the statistics are two
  dock list entries (`activity` order 0, `usage` order 1); **"Another plugin replaces one control
  by registering the same id and the same `order`; the dock orders rows by `order`, while a lower
  `priority` picks the replacement … A new id adds a control. Each control carries its id in
  `data-composer-stat`."**

### 1.2 The registration API

`ctx.slots` is the client slot registry (`@deepseek-ai/dsh-client-ui-slots`, injected as `slots`).

- `ctx.slots.register({ name, id, order, priority?, locale?, inject? }, Component)` — the entry.
  `order` sorts within a list slot (ascending; chat uses 0 → 1). `priority` only matters for
  same-`id` replacement. `locale: NS` makes the entry receive a bound `t`. `inject` is a function
  that returns extra props for the component (chat returns `{ hooks: { performanceUsage } }`;
  `dsh-context` returns `{ hooks: { contextModal } }`).
- `ctx.slots.inject(ownerKey, () => ctx.slots.register(...))` — lifecycle-scoped registration; the
  entry disappears with the owner context. Use this form, not bare `register`.

### 1.3 What a dock entry receives as props

From the shipped usage (`UsagePill({ useProjection, usePerformanceUsage, t })`):

| prop | source |
|---|---|
| `sessionId`, `session` (and other session-scope sources) | slot `scope: "session"` |
| `useProjection` | renderer-bound hook over the client projection store |
| `t` | present only because the entry declares `locale: NS` |
| anything in `inject()` | e.g. `hooks.<name>` |
| `useResource`, root hooks | provided by their owning plugins via `ctx.slots.provideRoot` |

A balance pill needs none of these beyond `t`: it is a global value, not session data.

### 1.4 How the Host hands data to the Client (the decision)

Chosen: **an exact HTTP route registered on the browser connection channel**.

Host half:

```ts
export const inject = ['connection', 'credentials'];

ctx.effect(
  () => ctx.connection.fetch.register({
    path: '/api/siliconflow.balance',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => Response.json(payload, { headers: { 'cache-control': 'no-store' } }),
  }),
  'siliconflow-balance: balance route',
);
```

Client half: `await fetch('/api/siliconflow.balance', { credentials: 'same-origin' })`.

Why this is correct here:
- It inherits Harness browser authentication (signed cookie issued from the `?token=` URL),
  the Host/Origin admission fence, and the connection's request middleware — see
  `@deepseek-ai/dsh-client-connection/README.md`.
- The same route works unchanged in Desktop and Web, because Desktop's window loads the
  Host-served page over HTTP (see §2.1).
- The API key never leaves the Host process; the browser sees only the formatted balance.

Reference implementations of exactly this pattern:
- `/Users/erwindassen/.dsh/profiles/desktop/node_modules/dsh-prompt-rewriter/index.js:1357`
  (`ctx.connection.fetch.register` for `/api/prompt-enhance` and `/api/prompt-enhance/settings`),
  consumed by `client.js:1142` with `fetch('/api/prompt-enhance', { credentials: 'same-origin' })`.
- `@deepseek-ai/dsh-client-ui-deliverables/lib/index.js` (routes `/api/present.host`,
  `/api/changes.summary`, `/api/changes.diff`, `/api/present.open`); its browser half calls
  `path.slice(1)` — the **document-relative** form of the same path — through a
  `HostReadStore` built on `createSnapshotStore` from `@deepseek-ai/dsh-client-store`.

### 1.5 Rejected alternatives

| option | why rejected |
|---|---|
| **Session projection** (`ctx.sessionProjections.register` + `wire.view`) | `@deepseek-ai/dsh-session-projection/README.md`: projections fold *committed session events* only, `apply(state, event)` must be pure/synchronous, and a state-carrying event must carry the complete post-change state. A balance is not session-derived; using this path would mean inventing session events for account state. |
| **`ctx.remote` (Typert remotes)** | `@deepseek-ai/dsh-api-remotes/README.md`: "The capability set is fixed by explicit build-time value imports; the Client does not discover the Host's active Services or Remote definitions at runtime." Not an extension point for a third-party package. |
| **Browser calls `api.siliconflow.com` directly** | CORS on the vendor API, and it would require shipping the API key to the browser. Disqualifying on both counts. |

---

## 2. Desktop vs Web

### 2.1 They render the same page

Desktop's Electron entry `/lib/main.js` (inside the asar) calls ``loadURL(`${this.origin}/`)`` —
the Desktop window loads the **Host-served HTTP page**, exactly as `dsh web` does (`loadFile` is
only used for the progress and mandatory-update pages). That is why the Desktop GUI has an
`http://127.0.0.1:<port>` URL. Therefore one client bundle serves both.

Desktop-only globals that a client plugin may see:
- `"dshDesktop" in globalThis` — the desktop marker (used e.g. by
  `@deepseek-ai/dsh-client-ui-settings-account/lib/client.js` to pick the host origin from
  `__DSH_TRANSPORT__.streamBaseUrl`).
- `__DSH_TRANSPORT__.streamBaseUrl`, `__DSH_HOST_PATHS__` (path chips for dropped folders).

Our plugin uses **relative** `/api/…` URLs with `credentials: 'same-origin'`, so none of these
differences touch it.

### 2.2 Bundling and activation are identical

- `@deepseek-ai/dsh-client-modules/README.md`: a plugin declares `dsh.client` in `package.json`
  with `platform: 'web'`, exports a `./client` bundle, and lists non-baseline module requests
  under `dsh.client.external`. The Host scans enabled Loader entries, composes the boot graph
  (`window.__DSH_BOOT__`), serves bundles under `/plugins`, and live-syncs graph changes over
  `/plugins/events` (SSE).
- Bundle contract (verified in shipped bundles):
  `window.__ModuleLoader__.load({ id: "<package name>", factory: (require) => { … return module.exports; } })`,
  lazy-CJS, `require('react')` / `require('react/jsx-runtime')` resolved from the frozen
  `PLATFORM_MODULES` table.
- Desktop-specific difference documented in the same README: **"Desktop re-reads package assets
  on every display — the Desktop forwarder rewrites every `/plugins/` cache header to `no-store`."**
  Practical effect: editing `lib/client.js` on disk is visible after a page reload in Desktop
  without cache busting.
- Live code reload (`dsh-client-hmr/README.md`) is a **Web-shell development workflow**
  (`pnpm run dev:web`, watched tsdown rebuilds, `/plugins/events` swap). Not available for the
  Desktop app bundle; expect a restart/refresh there.
- Build requirement: the Host serves built bundles, so `lib/client.js` must exist before launch —
  a missing bundle fails activation loudly.

### 2.3 Storage differs per profile — install twice

Profiles are separate compositions on this machine:

- `/Users/erwindassen/.dsh/profiles/desktop/package.json` → `dsh.profile.bundles` lists 18 bundles.
- `/Users/erwindassen/.dsh/profiles/web/package.json` → a different, smaller list (11 bundles).

`dsh-prompt-rewriter` is installed in **both** — the correct precedent for a user-facing widget.
So: the package is a normal dependency in each profile's `node_modules`, listed in that profile's
`dsh.profile.bundles`, and its own `cordis.patch.yml` supplies the Loader row.

Credentials are **not** per profile: `$DSH_HOME/.credentials.yaml`
(`/Users/erwindassen/.dsh/.credentials.yaml`, mode `-rw-------`) is machine-wide, so both profiles
see the same `SILICONFLOW_API_KEY`.

---

## 3. SiliconFlow balance API (verified 2025-08-13 docs + live probe)

Source: `https://docs.siliconflow.com/en/api-reference/userinfo/get-user-info`
(openapi `get /user/info`, server `https://api.siliconflow.com/v1`, spec file
`cn/api-reference/openapi.yaml`).

```
GET https://api.siliconflow.com/v1/user/info
Authorization: Bearer <API key from https://cloud.siliconflow.com/account/ak>
```

200 response (`application/json`):

```json
{
  "code": 20000,
  "message": "OK",
  "status": true,
  "data": {
    "id": "userid",
    "name": "username",
    "image": "user_avatar_image_url",
    "email": "user_email_address",
    "isAdmin": false,
    "balance": "0.88",
    "status": "normal",
    "introduction": "",
    "role": "",
    "chargeBalance": "88.00",
    "totalBalance": "88.88"
  }
}
```

Notes that matter for implementation:
- `balance`, `chargeBalance`, `totalBalance` are **strings** (decimal strings, 2 dp) — parse with
  a numeric step, never arithmetic on strings. `balance` = granted/free credit,
  `chargeBalance` = topped-up credit, `totalBalance` = their sum. Unit: CNY (元).
- `name` / `image` / `email` are documented to become fixed empty strings after June 11 — do not
  depend on them.
- Documented error statuses: 400, 401, 404, 429, 503, 504.
- CN domain, live probe without a key:
  `curl https://api.siliconflow.cn/v1/user/info` → `401 {"code":30014,"data":null,"message":"Token is invalid."}`
  — confirms the endpoint is live and the envelope is `{code, data, message}`.
- Required key scope: an ordinary account API key; no additional scope is documented for
  `/user/info`. The same key already used for inference works.

Decision: default `baseUrl` to `https://api.siliconflow.com/v1`, matching the existing
`llm-pi-ai` provider row (a CN account can override it in config).

---

## 4. Per-profile config and secrets

### 4.1 Config (declared, validated, readable at runtime)

```ts
import z from '@deepseek-ai/schemastery';

export const Config = z.object({
  baseUrl: z.string().default('https://api.siliconflow.com/v1'),
  credentialRef: z.string().default('SILICONFLOW_API_KEY'),
  refreshSeconds: z.natural().default(300).volatile(),
  showBreakdown: z.boolean().default(true).volatile(),
  warnThreshold: z.number().min(0).default(10).volatile(),   // CNY; 0 disables the amber warning
});

export function apply(ctx, rawConfig) { /* rawConfig = the Loader row's `config` */ }
```

- The activation-time config arrives as `apply(ctx, config)`.
- Live re-reads use the pattern from `dsh-prompt-rewriter/index.js:1008`:
  `const live = scope.fiber?.entry?.options?.config;` merged over the boot snapshot.
- `.volatile()` marks a field as a *live preference* the settings service may write; fields
  without it are "configuration" and are edited only by patch files. (Verbatim comment block at
  `dsh-prompt-rewriter/index.js:29-45` explains why: `volatileForm()` keeps only volatile fields,
  and a `Config` with none is rejected by `settings.write()`.)
- Writing from a plugin-owned settings route: `ctx.get('settings').update(ns, patch)`, where `ns`
  is the **short Loader row id** (`row.options.id`), never `fiber.entry.id` (which concatenates
  ancestors as `include:<id>` and fails with `No configurable plugin entry`).

### 4.2 Secrets (never in config)

```ts
import { credentialRef } from '@deepseek-ai/dsh-credentials';

const ref = credentialRef(config.credentialRef);      // branded POSIX identifier
const hit = await ctx.credentials.resolve(ref);       // { value, source } | undefined
const info = await ctx.credentials.describe(ref);     // { configured, source?, writable } — no value
await ctx.credentials.set(ref, 'sk-…');               // stored value outranks env
await ctx.credentials.unset(ref);
```

Rules from `@deepseek-ai/dsh-credentials/README.md`:
- config carries references, never secrets; resolution is **per call** (no cross-operation cache),
  which is what makes a rotated key apply without a restart;
- a stored key outranks the launching environment; an empty stored value counts as absent;
- store location `$DSH_HOME/.credentials.yaml`, owner-only, refuses a world-readable file.

This machine already has that file with `version` / `records` / `refs` sections and **no**
`SILICONFLOW_*` variable in the process environment — consistent with the key being a stored
`refs` entry behind the existing `apiKeyEnv: SILICONFLOW_API_KEY` in the `llm-pi-ai` row.

**Therefore: reuse `SILICONFLOW_API_KEY`. No new secret, nothing to provision.**

---

## 5. Package layout, build, name

### 5.1 Name

- Package: **`dsh-siliconflow-balance`** (matches the community convention `dsh-*`).
- Loader row id / slot entry id: **`siliconflow-balance`**.
- Display title (`locale/*.json` → `meta.title`): 硅基流动余额 / "SiliconFlow balance".

### 5.2 Layout

```
dsh-siliconflow-balance/
├─ package.json
├─ cordis.patch.yml
├─ tsconfig.json                    # Host half: emit lib/ + lib/types/
├─ tsconfig.client.json             # Client half: typecheck only (tsdown builds the bundle)
├─ tsdown.config.ts
├─ scripts/wrap-client-bundle.mjs   # wraps built CJS into window.__ModuleLoader__.load(...)
├─ docs/design.md
├─ src/
│  ├─ index.ts        # host half: apply / inject / Config / route / TTL cache / upstream call
│  ├─ balance.ts      # pure: parse user/info → { total, charge, granted } + format CNY
│  ├─ client.tsx      # browser half: factory registration, slot register, pill + popover
│  └─ types.ts        # shared wire payload types (Host route ↔ client pill)
├─ locale/en.json, locale/zh.json
├─ icon.svg
├─ test/balance.test.ts
├─ LICENSE
├─ .gitignore
└─ README.md
```

### 5.3 package.json essentials

```jsonc
{
  "name": "dsh-siliconflow-balance",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": "./lib/client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["lib", "locale", "icon.svg", "cordis.patch.yml", "README.md", "LICENSE"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-conversation"
      ]
    }
  },
  "peerDependencies": {
    "@deepseek-ai/schemastery": "^3.18.1",
    "react": "^18.3.1"
  }
}
```

Two packaging facts learned while scaffolding this repo:

1. The Host services (`connection`, `credentials`) are resolved **by name from the runtime**
   (`inject: ['connection', 'credentials']`), not imported from packages. Declaring
   `@deepseek-ai/dsh-client-connection` / `dsh-credentials` as npm peers fails today:
   `dsh-client-connection@0.0.1-rc.1` transitively requires `@deepseek-ai/dsh-user-interaction`,
   which is **not on the npm registry** (`pnpm` exits with `ERR_PNPM_FETCH_404`). The client UI
   packages stay in `dsh.client.inject` (runtime graph ordering) and are not installed as peers.
2. `dsh-prompt-rewriter` also sets `"immediately": true` under `dsh.client`; its effect is not
   documented in the shipped packages — omitted here until confirmed.

### 5.4 cordis.patch.yml

```yaml
- insert:
    - id: siliconflow-balance
      name: dsh-siliconflow-balance
```

### 5.5 Build

- **Host half**: `tsc` → `lib/index.js` + `lib/types/**` (`tsconfig.json`).
- **Client half**: `tsdown` → single CJS file, then a ~20-line wrapper that emits

  ```js
  window.__ModuleLoader__.load({ id: "dsh-siliconflow-balance", factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    /* tsdown body */
    return module.exports;
  }});
  ```

  `dsh-plugin` does exactly this (`build:client: tsdown && node scripts/tools/normalize-client-banner.mjs`),
  and its shipped bundle at `node_modules/dsh-plugin/client/client.js` shows the resulting shape.
- tsdown settings that matter (verified by building the scaffold):
  - `format: 'cjs'` with `type: module` emits `lib/client.cjs` by default → set
    `outExtensions: () => ({ js: '.js' })` so the loader path is `lib/client.js`;
  - CJS normally targets Node, so pass `inputOptions: { platform: 'browser' }`;
  - `deps.neverBundle: ['react', 'react/jsx-runtime']` (the `external` option is deprecated).
- `vitest` for the pure parser/formatter (no DOM), which is where all the interesting logic lives.

### 5.6 Styling

Do **not** import `@deepseek-ai/dsh-client-ui-primitives` in a new plugin (skill rule + package
guidance); copy the markup and the `--dsw-alias-*` tokens. The shipped pill CSS is in
`@deepseek-ai/dsh-client-ui-chat/lib/client.js` (`css$1`):

```
.TQ0rwa_anchor { min-width:0; font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px); line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px)); display:inline-flex }
.TQ0rwa_pill   { border-radius:var(--dsw-radius-sm); color:var(--dsw-alias-label-tertiary); font-variant-numeric:tabular-nums; background:0 0; border:none; align-items:center; gap:6px; padding:1px 8px; display:inline-flex }
.TQ0rwa_label  { text-overflow:ellipsis; min-width:0; overflow:hidden }
.TQ0rwa_sep    { color:var(--dsw-alias-separator-primary); margin:0 6px }
```

and the markup is `span.anchor[data-composer-stat=<id>] > span.pill > [icon, span.label]`.

### 5.7 Behaviour (graceful offline, no secrets, low cost)

**Refresh loop (client).** Fetch on mount, then every `refreshSeconds` (default 300 s) *while the
page is visible*; skip a tick when `document.hidden`; revalidate once on `visibilitychange` →
visible and on window `focus`; stop when the dock entry unmounts. At most one request in flight —
a tick that fires during an in-flight fetch is dropped, not queued.

**Host cache.** Memoize the upstream sample for `min(refreshSeconds/2, 60 s)` and return
`{ …payload, asOf }`. Concurrent requests (several windows/tabs) share one upstream call. This
bounds vendor traffic to ≤12 requests/hour while the page is open and 0 while it is hidden.

**States.** The pill renders exactly one of these; a `data-state` attribute drives the styling:

| state | pill | popover |
|---|---|---|
| `loading` (first fetch, no data yet) | `余额 …`, muted | — |
| `ok` | `¥88.88`, tertiary label color | granted / topped-up / total + "updated HH:mm" |
| `low` (`total < warnThreshold`) | `¥8.42`, amber | same as `ok`, with the threshold stated |
| `stale` (last fetch failed, cached value exists) | value + muted dot | last sample time + "could not refresh" |
| `unconfigured` (no credential) | `余额 —`, muted | "Add SILICONFLOW_API_KEY in Settings" |
| `unauthorized` (401/403 from vendor) | `余额 —`, muted | "API key rejected — check Settings" |

**Failure policy.** Upstream failures are reported as HTTP `200` with `{ ok:false, reason }`,
never a 5xx, so the composer is never blocked. 401/403 marks `unauthorized` once and backs off to
the normal interval (no retry storm). The Host logs a failure only when the state changes, not on
every poll.

**Popover.** Click toggles a small informational popover anchored to the pill; Escape or an
outside click closes it; no focus trap (it holds no actions except "Refresh now"). The pill is a
real `<button>` with `aria-expanded`, so keyboard users can open it.

**Threshold.** `warnThreshold` (default ¥10) turns the pill amber while `total < threshold`;
`0` disables the warning entirely. The tooltip repeats the exact amount either way.

### 5.8 Installation (local package, both profiles)

Decided: develop in `~/Projects/dsh-siliconflow-balance`, install the local package directory into
**both** profiles (`desktop` and `web`) — same bundle, since Desktop loads the Host-served page.

1. `pnpm install && pnpm build` → `lib/index.js` (Host) + `lib/client.js` (browser bundle).
2. Install the absolute package directory with `plugin_manager` `install_bundle`; it writes the
   profile dependency and the `dsh.profile.bundles` entry. Repeat once per profile.
3. Reload the page. The pill appears in `data-composer-dock`, right of the token-usage pill
   (`data-composer-stat="siliconflow-balance"`), with `order: 2`.
4. After any source change: rebuild, then reload. Desktop serves `/plugins/` with `no-store`, so a
   reload is enough; Web may need a hard reload.
5. Uninstall by removing the bundle from the profile (same `plugin_manager` path in reverse).

---

## 6. ADR-001

**Title:** Publish the balance from the Host through an exact connection route.

**Status:** Accepted (2026-11-10).

**Context:** the pill needs an account-level value that is invisible to the session log, must work
identically in Desktop and Web, and must not expose the API key to the browser. Client plugins can
only obtain Host data through mechanisms the shell already mounts.

**Decision:** host plugin registers `GET /api/siliconflow.balance` on `ctx.connection.fetch`; the
client entry fetches it with `credentials: 'same-origin'`.

**Consequences:**
- (+) Zero new transport, zero browser-side secret, auth/admission inherited, identical in Desktop
  and Web, trivially testable (curl with the browser cookie, or the plugin's own route).
- (+) The Host owns caching, retries, and formatting, so the UI stays dumb.
- (−) One extra HTTP round-trip per refresh; the browser must tolerate a page reload losing the
  in-memory value (acceptable: refetch on mount).
- (−) Depends on `ctx.connection.fetch` remaining a public seam (it is documented and used by two
  shipped plugins).

---

## 7. Decisions (confirmed 2026-11-10)

| # | Topic | Decision |
|---|---|---|
| 1 | Package name | **`dsh-siliconflow-balance`**; Loader row id and slot entry id `siliconflow-balance` |
| 2 | Credential | Reuse the existing stored ref **`SILICONFLOW_API_KEY`**. No new secret to provision; rotating the inference key rotates the balance key too |
| 3 | Refresh | Every **300 s while visible**; paused when `document.hidden`; revalidate on focus/visibility change; Host cache ≤60 s |
| 4 | Display | **`totalBalance`** as `¥88.88` (two decimals, `¥` prefix); click opens the breakdown popover (granted / topped-up / total / updated) |
| 5 | Empty composer | Accepted: the pill exists only once a conversation is open. No second surface in v1 |
| 6 | Install | Local package directory in `~/Projects`, installed into **both** `desktop` and `web` profiles |
| 7 | Settings | **Config-only** for v1 (`cordis.patch.yml` row config); no settings panel |
| 8 | Low balance | Amber below `warnThreshold`, **default ¥10**, configurable; `0` disables |
| 9 | i18n | `zh` + `en` at launch (`locale/en.json`, `locale/zh.json`) |
| 10 | Logging | Log **state transitions** to the Host log only; never per poll |

### 7.1 Deferred / non-goals for v1

- An in-app settings panel (base URL, interval, key status) — revisit if tuning is actually needed.
- A second surface outside a conversation (hero screen, sidebar, settings page).
- Currency switching for the international/USD platform; formatting only, once a real response
  confirms the unit (CNY on the CN account).
- Usage history, spend charts, notifications/toasts on low balance.
- Public npm publication; the package is installed from its local directory.

---

## 8. Risks / unknowns

- `dsh.client.immediately` is used by installed plugins but not documented in the shipped packages;
  its effect is unverified (harmless either way).
- The dock slot renders only with a live session; a "global" balance therefore has no place to show
  outside a conversation.
- `@deepseek-ai/dsh-client-ui-slots` is not shipped as a separate package in the app bundle, so TS
  types for `ctx.slots` come from the published package at authoring time.
- SiliconFlow currency is CNY; if Erwin's account were on the international USD platform, the same
  field names would apply but the unit would differ — worth confirming once with a real response.

---

## 9. Implementation plan (next)

1. **Scaffold & tooling** — done by the repo initialization: package manifest, tsconfigs, tsdown
   config, banner wrapper, patch row, locale resources, icon.
2. **Host core** — `src/balance.ts` parser/formatter with `vitest` unit tests; `src/index.ts` route
   with the TTL cache, credential resolution, and the `ok`/`unconfigured`/`unauthorized`/`upstream`
   state machine.
3. **Client pill** — `src/client.tsx`: registration through
   `ctx.slots.inject('conversation.composer.dock', …)`, mount fetch + refresh loop + visibility
   handling, the six pill states, the breakdown popover, and threshold styling.
4. **First live check** — install into `desktop`, open a conversation, and confirm the pill value
   matches a manual `GET /v1/user/info`.
5. **Both profiles + polish** — install into `web`, README screenshots, tag `v0.1.0`.

Acceptance criteria for the first version:
- the pill shows `¥<totalBalance>` and its popover breaks out granted/topped-up/total;
- the API key never appears in any browser-visible response, and the browser makes no direct
  calls to `api.siliconflow.com`;
- an upstream outage or a missing key degrades to a muted/stale pill, never a composer error;
- no upstream traffic while the page is hidden;
- identical behaviour in Desktop and Web from one bundle.

## 10. Addendum — 2026-11-12: the balance endpoint was retired upstream

SiliconFlow retired `GET /v1/user/info` on 2026-08-14 (HTTP 410, `code: 20092`); the
companion `GET /v1/models` still answers 200 with the same key. §5.7 assumed the endpoint
would stay available, so the failure taxonomy gains one reason:

- `retired` — the Host saw HTTP 410. It is not an `upstream` error: retrying cannot help.
- Client: distinct `retired` state, muted pill, popover text that names the retirement date
  and links to the console, and the refresh loop backs off to every 30 minutes instead of
  every `refreshSeconds`, so a restored route revives the pill without user action.

The console balance is only reachable with the browser's session cookie. The plugin keeps
its key-only contract (§6 ADR-001) and does not read console session state.

## 11. Addendum — 2026-11-12: console-session mode replaces the API-key path

Erwin captured the console's own balance request in Safari:

```
GET https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek
Cookie: <console session>
x-subject-id: <account short id>
→ 200 {"code":20000,"data":{"financialInfo":{"available":"906696398000",
        "recharged":"5000000000000","used":"4093303602000", ...}}}
```

That endpoint does not accept an API key (without credentials, with `Authorization: Bearer`, and
with `X-API-Key` it always answers `307` to the account login). So the data path is the console
session, and the product decision (m00907) is:

- drop the API-key data path entirely — the plugin's only source is the console wallet service;
- the pasted `Cookie` and `x-subject-id` go into the DSH **credential store** through the
  `credentials` service, never into plugin config, and are never returned to the browser;
- ship a config plane the way other plugins do: the schemastery `Config` on the Loader row plus a
  free-form `settings.section` that explains what to copy, opens the console page in the default
  browser (`window.open(url, '_blank', 'noopener,noreferrer')`), and takes the two paste fields;
- the wallet route is called with `redirect: 'manual'`, so a login redirect becomes a distinct
  `unauthorized` state instead of an HTML body parsed as JSON.

Three same-origin routes replace ADR-001's single route:

| route | method | purpose |
| --- | --- | --- |
| `/api/siliconflow.balance` | GET | current reading (cached ≤60 s, single-flight) |
| `/api/siliconflow.balance/session` | POST | validate the pasted session, then store it |
| `/api/siliconflow.balance/clear` | POST | forget both credentials |

State machine changes: `unconfigured` now means "no session pasted", `unauthorized` means "console
rejected the session", and the refresh loop backs off to 30 minutes while unauthorized. The pill
keeps the last reading on a transient failure (`stale`). `retired` remains for a 410 from the
wallet route.

Units: wallet amounts are nano-yuan integer strings (`1e-9` CNY) and are scaled on the decimal
string, not with `BigInt` division, so amounts above `Number.MAX_SAFE_INTEGER` round exactly once.
`available` is the spendable balance and is what the pill shows; `recharged` and `used` fill the
popover, and `available + used = recharged` for a consistent response.

Version 0.3.0 ships this model; 0.1.0 (API key) and 0.2.0 (retired notice) are historical tags.
