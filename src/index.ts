import z from '@deepseek-ai/schemastery';
import { DEFAULT_BASE_URL, UPSTREAM_TIMEOUT_MS, parseUserInfo, userInfoUrl } from './balance.js';
import type { BalanceFailure, BalancePayload, BalancePolicy } from './types.js';

export const name = 'dsh-siliconflow-balance';

/** Services this Host half needs: the browser connection and credentials. */
export const inject: string[] = ['connection', 'credentials'];

/** Exact same-origin route the browser half polls. */
export const ROUTE_PATH = '/api/siliconflow.balance';

/**
 * The Loader row's config. The three preferences are `.volatile()` so a settings
 * surface can write them later; `baseUrl` and `credentialRef` stay patch-only
 * configuration. See docs/design.md §4.1.
 */
export const Config = z.object({
  baseUrl: z.string().default(DEFAULT_BASE_URL),
  credentialRef: z.string().default('SILICONFLOW_API_KEY'),
  refreshSeconds: z.natural().default(300).volatile(),
  showBreakdown: z.boolean().default(true).volatile(),
  warnThreshold: z.number().min(0).default(10).volatile(),
});

/** Validated row config, after defaults. */
export interface ResolvedConfig {
  baseUrl: string;
  credentialRef: string;
  refreshSeconds: number;
  showBreakdown: boolean;
  warnThreshold: number;
}

/** Lower / upper bounds for the client refresh interval (seconds). */
const MIN_REFRESH_SECONDS = 30;
const MAX_REFRESH_SECONDS = 3600;

/** Host-side sample cache cap: `min(refreshSeconds / 2, 60 s)`. */
const MAX_CACHE_SECONDS = 60;

/**
 * Minimal shape of the services this plugin uses. Declared structurally so the
 * package needs no `@deepseek-ai/*` runtime dependency beyond schemastery: the
 * services are resolved by name from the running Host.
 */
interface CredentialValue {
  readonly value: string;
}

interface CredentialsLike {
  resolve(ref: string): Promise<CredentialValue | undefined>;
}

interface ConnectionRoute {
  path: string;
  methods: readonly ('GET' | 'HEAD' | 'POST')[];
  requestBody: 'buffered' | 'streaming';
  fetch: (request: Request) => Promise<Response>;
}

interface ConnectionLike {
  fetch: {
    register(route: ConnectionRoute): () => Promise<void>;
  };
}

interface HostContext {
  connection: ConnectionLike;
  credentials: CredentialsLike;
  effect(callback: () => (() => unknown) | void, label?: string): void;
}

/** A schemastery `.volatile()` field arrives as `{ get(): T }`, or plain when not yet bound. */
type ConfigField<T> = T | { get(): T };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read one config field, unwrapping a volatile accessor. */
function readField(value: unknown): unknown {
  if (isRecord(value) && typeof value['get'] === 'function') {
    try {
      return (value['get'] as () => unknown)();
    } catch {
      return undefined;
    }
  }
  return value;
}

function readString(value: unknown, fallback: string): string {
  const plain = readField(value);
  return typeof plain === 'string' && plain.trim().length > 0 ? plain.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  const plain = readField(value);
  return typeof plain === 'boolean' ? plain : fallback;
}

function readAmount(value: unknown, fallback: number): number {
  const plain = readField(value);
  return typeof plain === 'number' && Number.isFinite(plain) && plain >= 0 ? plain : fallback;
}

function readRefresh(value: unknown, fallback: number): number {
  const plain = readField(value);
  if (typeof plain !== 'number' || !Number.isFinite(plain) || plain < 1) return fallback;
  return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.floor(plain)));
}

/**
 * Normalize the row config without trusting it: an unknown or malformed field
 * falls back to its default instead of disabling the plugin.
 *
 * The Loader may hand over either plain values or schemastery volatile
 * accessors, so every read goes through `readField`.
 */
export function resolveConfig(raw: unknown): ResolvedConfig {
  const config = isRecord(raw) ? raw : {};
  const baseUrl = readString(config['baseUrl'], DEFAULT_BASE_URL);
  return {
    baseUrl: isHttpUrl(baseUrl) ? baseUrl : DEFAULT_BASE_URL,
    credentialRef: readString(config['credentialRef'], 'SILICONFLOW_API_KEY'),
    refreshSeconds: readRefresh(config['refreshSeconds'], 300),
    showBreakdown: readBoolean(config['showBreakdown'], true),
    warnThreshold: readAmount(config['warnThreshold'], 10),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Cache lifetime for one successful upstream sample, in milliseconds. */
function cacheTtlMs(config: ResolvedConfig): number {
  const seconds = Math.min(MAX_CACHE_SECONDS, Math.max(5, Math.floor(config.refreshSeconds / 2)));
  return seconds * 1000;
}

/**
 * Host half.
 *
 * Registers `GET /api/siliconflow.balance` on `ctx.connection.fetch`, resolves
 * the configured credential, calls `${baseUrl}/user/info`, and serves the cached
 * payload described in docs/design.md §5.7. Failures are HTTP 200 with
 * `{ ok: false, reason }` so the composer is never blocked; the API key never
 * appears in the answer.
 */
export function apply(ctx: HostContext, rawConfig: unknown): void {
  const config = resolveConfig(rawConfig);
  const policy: BalancePolicy = {
    refreshSeconds: config.refreshSeconds,
    warnThreshold: config.warnThreshold,
    showBreakdown: config.showBreakdown,
  };

  let cached: { payload: BalancePayload; sampledAt: number } | undefined;
  let inFlight: Promise<BalancePayload> | undefined;
  let lastState: string | undefined;

  /** Log one line per *state transition*, never per poll (design §5.7). */
  function report(payload: BalancePayload): void {
    const state = payload.ok ? 'ok' : (payload.reason ?? 'upstream');
    if (state === lastState) return;
    lastState = state;
    const suffix = payload.upstreamStatus === undefined ? '' : ` (upstream HTTP ${payload.upstreamStatus})`;
    if (payload.ok && payload.amounts) {
      console.info(`[dsh-siliconflow-balance] state: ok, total ${payload.amounts.total.toFixed(2)} CNY${suffix}`);
    } else {
      console.warn(`[dsh-siliconflow-balance] state: ${state}${suffix}`);
    }
  }

  function failure(reason: BalanceFailure, upstreamStatus?: number): BalancePayload {
    return {
      ok: false,
      reason,
      ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
      policy,
    };
  }

  async function resolveKey(): Promise<string | undefined> {
    let resolved: CredentialValue | undefined;
    try {
      // `CredentialRef` is a branded string; the runtime value is the plain ref.
      resolved = await ctx.credentials.resolve(config.credentialRef);
    } catch (error) {
      console.warn('[dsh-siliconflow-balance] credential lookup failed:', error);
      return undefined;
    }
    const value = resolved?.value?.trim();
    return value ? value : undefined;
  }

  async function readUpstream(): Promise<BalancePayload> {
    const apiKey = await resolveKey();
    if (!apiKey) return failure('unconfigured');

    let response: Response;
    try {
      response = await fetch(userInfoUrl(config.baseUrl), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      return failure('upstream');
    }

    if (response.status === 401 || response.status === 403) {
      return failure('unauthorized', response.status);
    }
    if (!response.ok) {
      return failure('upstream', response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failure('invalid-response', response.status);
    }

    try {
      const amounts = parseUserInfo(body);
      return {
        ok: true,
        amounts,
        asOf: new Date().toISOString(),
        policy,
      };
    } catch {
      return failure('invalid-response', response.status);
    }
  }

  /**
   * Answer from the sample cache when fresh, else share one upstream call among
   * all concurrent requests (several tabs/windows hitting the route at once).
   */
  async function load(): Promise<BalancePayload> {
    const ttl = cacheTtlMs(config);
    if (cached && Date.now() - cached.sampledAt < ttl) {
      return cached.payload;
    }
    if (!inFlight) {
      inFlight = readUpstream()
        .then((payload) => {
          report(payload);
          if (payload.ok) cached = { payload, sampledAt: Date.now() };
          return payload;
        })
        .finally(() => {
          inFlight = undefined;
        });
    }
    return inFlight;
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => {
          const payload = await load();
          return Response.json(payload, {
            headers: {
              'cache-control': 'no-store',
            },
          });
        },
      }),
    'dsh-siliconflow-balance: balance route',
  );
}
