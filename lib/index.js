import z from '@deepseek-ai/schemastery';
import { DEFAULT_BASE_URL, UPSTREAM_TIMEOUT_MS, parseUserInfo, userInfoUrl } from './balance.js';
export const name = 'dsh-siliconflow-balance';
/** Services this Host half needs: the browser connection and credentials. */
export const inject = ['connection', 'credentials'];
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
/** Lower / upper bounds for the client refresh interval (seconds). */
const MIN_REFRESH_SECONDS = 30;
const MAX_REFRESH_SECONDS = 3600;
/** Host-side sample cache cap: `min(refreshSeconds / 2, 60 s)`. */
const MAX_CACHE_SECONDS = 60;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Read one config field, unwrapping a volatile accessor. */
function readField(value) {
    if (isRecord(value) && typeof value['get'] === 'function') {
        try {
            return value['get']();
        }
        catch {
            return undefined;
        }
    }
    return value;
}
function readString(value, fallback) {
    const plain = readField(value);
    return typeof plain === 'string' && plain.trim().length > 0 ? plain.trim() : fallback;
}
function readBoolean(value, fallback) {
    const plain = readField(value);
    return typeof plain === 'boolean' ? plain : fallback;
}
function readAmount(value, fallback) {
    const plain = readField(value);
    return typeof plain === 'number' && Number.isFinite(plain) && plain >= 0 ? plain : fallback;
}
function readRefresh(value, fallback) {
    const plain = readField(value);
    if (typeof plain !== 'number' || !Number.isFinite(plain) || plain < 1)
        return fallback;
    return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.floor(plain)));
}
/**
 * Normalize the row config without trusting it: an unknown or malformed field
 * falls back to its default instead of disabling the plugin.
 *
 * The Loader may hand over either plain values or schemastery volatile
 * accessors, so every read goes through `readField`.
 */
export function resolveConfig(raw) {
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
function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/** Cache lifetime for one successful upstream sample, in milliseconds. */
function cacheTtlMs(config) {
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
export function apply(ctx, rawConfig) {
    const config = resolveConfig(rawConfig);
    const policy = {
        refreshSeconds: config.refreshSeconds,
        warnThreshold: config.warnThreshold,
        showBreakdown: config.showBreakdown,
    };
    let cached;
    let inFlight;
    let lastState;
    /** Log one line per *state transition*, never per poll (design §5.7). */
    function report(payload) {
        const state = payload.ok ? 'ok' : (payload.reason ?? 'upstream');
        if (state === lastState)
            return;
        lastState = state;
        const suffix = payload.upstreamStatus === undefined ? '' : ` (upstream HTTP ${payload.upstreamStatus})`;
        if (payload.ok && payload.amounts) {
            console.info(`[dsh-siliconflow-balance] state: ok, total ${payload.amounts.total.toFixed(2)} CNY${suffix}`);
        }
        else {
            console.warn(`[dsh-siliconflow-balance] state: ${state}${suffix}`);
        }
    }
    function failure(reason, upstreamStatus) {
        return {
            ok: false,
            reason,
            ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
            policy,
        };
    }
    async function resolveKey() {
        let resolved;
        try {
            // `CredentialRef` is a branded string; the runtime value is the plain ref.
            resolved = await ctx.credentials.resolve(config.credentialRef);
        }
        catch (error) {
            console.warn('[dsh-siliconflow-balance] credential lookup failed:', error);
            return undefined;
        }
        const value = resolved?.value?.trim();
        return value ? value : undefined;
    }
    async function readUpstream() {
        const apiKey = await resolveKey();
        if (!apiKey)
            return failure('unconfigured');
        let response;
        try {
            response = await fetch(userInfoUrl(config.baseUrl), {
                method: 'GET',
                headers: {
                    authorization: `Bearer ${apiKey}`,
                    accept: 'application/json',
                },
                signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            });
        }
        catch {
            return failure('upstream');
        }
        if (response.status === 401 || response.status === 403) {
            return failure('unauthorized', response.status);
        }
        if (!response.ok) {
            return failure('upstream', response.status);
        }
        let body;
        try {
            body = await response.json();
        }
        catch {
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
        }
        catch {
            return failure('invalid-response', response.status);
        }
    }
    /**
     * Answer from the sample cache when fresh, else share one upstream call among
     * all concurrent requests (several tabs/windows hitting the route at once).
     */
    async function load() {
        const ttl = cacheTtlMs(config);
        if (cached && Date.now() - cached.sampledAt < ttl) {
            return cached.payload;
        }
        if (!inFlight) {
            inFlight = readUpstream()
                .then((payload) => {
                report(payload);
                if (payload.ok)
                    cached = { payload, sampledAt: Date.now() };
                return payload;
            })
                .finally(() => {
                inFlight = undefined;
            });
        }
        return inFlight;
    }
    ctx.effect(() => ctx.connection.fetch.register({
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
    }), 'dsh-siliconflow-balance: balance route');
}
//# sourceMappingURL=index.js.map