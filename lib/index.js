import z from '@deepseek-ai/schemastery';
import { CONSOLE_ORIGIN, UPSTREAM_TIMEOUT_MS, consolePageUrl, parseWalletPeek, peekUrl, } from './balance.js';
export const name = 'dsh-siliconflow-balance';
/** Services this Host half needs: the browser connection and credentials. */
export const inject = ['connection', 'credentials'];
/** Same-origin route the browser half polls for a reading. */
export const ROUTE_PATH = '/api/siliconflow.balance';
/** Same-origin route that validates and stores a pasted console session. */
export const SESSION_PATH = `${ROUTE_PATH}/session`;
/** Same-origin route that forgets the stored console session. */
export const CLEAR_PATH = `${ROUTE_PATH}/clear`;
/**
 * Credential refs the console session lives under. They are real DSH credentials
 * (not patch config), so the cookie never sits in plaintext YAML.
 */
export const COOKIE_REF = 'SILICONFLOW_CONSOLE_COOKIE';
export const SUBJECT_REF = 'SILICONFLOW_CONSOLE_SUBJECT';
/**
 * The Loader row's config. This *is* the plugin's config plane: DSH renders a
 * settings form from this schema, including the field descriptions below.
 */
export const Config = z.object({
    consoleBaseUrl: z
        .string()
        .default(CONSOLE_ORIGIN)
        .description('Console origin the wallet request is sent to. Change it only if SiliconFlow moves the console.'),
    cookieRef: z
        .string()
        .default(COOKIE_REF)
        .description('DSH credential that stores the pasted console Cookie header.'),
    subjectRef: z
        .string()
        .default(SUBJECT_REF)
        .description('DSH credential that stores the pasted x-subject-id header value.'),
    refreshSeconds: z
        .natural()
        .default(300)
        .volatile()
        .description('How often the composer pill refreshes while the window is visible.'),
    showBreakdown: z
        .boolean()
        .default(true)
        .volatile()
        .description('Show the available / recharged / used breakdown in the popover.'),
    warnThreshold: z
        .number()
        .min(0)
        .default(10)
        .volatile()
        .description('Turn the pill amber below this many US dollars. Set 0 to disable the warning.'),
});
const MIN_REFRESH_SECONDS = 30;
const MAX_REFRESH_SECONDS = 3600;
/** Host-side sample cache cap: `min(refreshSeconds / 2, 60 s)`. */
const MAX_CACHE_SECONDS = 60;
/** Read a schemastery field that may be a plain value or a volatile `{get()}` ref. */
function readField(value, fallback) {
    if (value !== null &&
        typeof value === 'object' &&
        typeof value.get === 'function') {
        const live = value.get();
        return live === undefined ? fallback : live;
    }
    return value === undefined ? fallback : value;
}
/** Validate and clamp the row config. Never throws: bad input falls back. */
export function resolveConfig(raw) {
    const source = (raw ?? {});
    const consoleBaseUrl = String(readField(source.consoleBaseUrl, CONSOLE_ORIGIN)).trim();
    const validBase = /^https?:\/\/\S+$/.test(consoleBaseUrl) ? consoleBaseUrl : CONSOLE_ORIGIN;
    const refreshRaw = Number(readField(source.refreshSeconds, 300));
    const refreshSeconds = Number.isFinite(refreshRaw)
        ? Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.round(refreshRaw)))
        : 300;
    const thresholdRaw = Number(readField(source.warnThreshold, 10));
    const warnThreshold = Number.isFinite(thresholdRaw) && thresholdRaw >= 0 ? thresholdRaw : 10;
    return {
        consoleBaseUrl: validBase,
        cookieRef: String(readField(source.cookieRef, COOKIE_REF)).trim() || COOKIE_REF,
        subjectRef: String(readField(source.subjectRef, SUBJECT_REF)).trim() || SUBJECT_REF,
        refreshSeconds,
        showBreakdown: Boolean(readField(source.showBreakdown, true)),
        warnThreshold,
    };
}
function presentationOf(config) {
    return {
        refreshSeconds: config.refreshSeconds,
        warnThreshold: config.warnThreshold,
        showBreakdown: config.showBreakdown,
    };
}
/** Payload skeleton every answer fills in. */
function skeleton(config, configured) {
    return {
        ok: false,
        policy: presentationOf(config),
        consoleUrl: consolePageUrl(config.consoleBaseUrl),
        configured,
    };
}
function failurePayload(config, reason, configured, upstreamStatus) {
    return {
        ...skeleton(config, configured),
        reason,
        ...(upstreamStatus === undefined ? {} : { upstreamStatus }),
    };
}
/** The cookie is one `Cookie` header value; the subject id looks like `dbksd…`. */
const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{6,256}$/;
const COOKIE_MAX_LENGTH = 8192;
/** Validate the pasted session. Throws a message meant for the setup panel. */
export function parseSessionInput(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('expected a JSON object with cookie and subjectId');
    }
    const record = body;
    const cookie = typeof record.cookie === 'string' ? record.cookie.trim() : '';
    const subjectId = typeof record.subjectId === 'string' ? record.subjectId.trim() : '';
    if (cookie === '') {
        throw new Error('cookie is empty');
    }
    if (cookie.length > COOKIE_MAX_LENGTH) {
        throw new Error('cookie is too long');
    }
    if (!/[A-Za-z0-9_.-]+=/.test(cookie)) {
        throw new Error('cookie does not look like a Cookie header (name=value pairs)');
    }
    if (!SUBJECT_PATTERN.test(subjectId)) {
        throw new Error('subject id must be 6-256 letters, digits, dashes or underscores');
    }
    return { cookie, subjectId };
}
/** Ask the console wallet service about the subject behind a session. */
async function callConsole(config, session) {
    return fetch(peekUrl(config.consoleBaseUrl), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: {
            accept: 'application/json',
            cookie: session.cookie,
            'x-subject-id': session.subjectId,
        },
    });
}
/**
 * Map a console answer onto a payload. Only a 200 with the wallet envelope is
 * `ok`; a login redirect or 401/403 means the session is no longer good.
 */
async function interpret(config, response) {
    if (response.status >= 300 && response.status < 400) {
        return failurePayload(config, 'unauthorized', true, response.status);
    }
    if (response.status === 401 || response.status === 403) {
        return failurePayload(config, 'unauthorized', true, response.status);
    }
    if (response.status === 410) {
        return failurePayload(config, 'retired', true, response.status);
    }
    if (!response.ok) {
        return failurePayload(config, 'upstream', true, response.status);
    }
    let body;
    try {
        body = await response.json();
    }
    catch {
        return failurePayload(config, 'invalid-response', true, response.status);
    }
    try {
        const reading = parseWalletPeek(body);
        return {
            ...skeleton(config, true),
            ok: true,
            amounts: reading.amounts,
            asOf: reading.asOf,
        };
    }
    catch {
        return failurePayload(config, 'invalid-response', true, response.status);
    }
}
/** Read the stored session out of DSH credentials. */
async function storedSession(ctx, config) {
    const [cookie, subject] = await Promise.all([
        ctx.credentials.resolve(config.cookieRef),
        ctx.credentials.resolve(config.subjectRef),
    ]);
    const cookieValue = cookie?.value?.trim() ?? '';
    const subjectValue = subject?.value?.trim() ?? '';
    if (cookieValue === '' || subjectValue === '')
        return undefined;
    return { cookie: cookieValue, subjectId: subjectValue };
}
/**
 * The Host half: resolves the pasted console session, calls the console wallet
 * service, caches a sample briefly, and publishes the same-origin routes.
 */
export function apply(ctx, rawConfig) {
    const config = resolveConfig(rawConfig);
    const cacheTtlMs = Math.min(MAX_CACHE_SECONDS, Math.max(5, Math.floor(config.refreshSeconds / 2))) * 1000;
    let sample;
    let inFlight;
    let lastState = 'unknown';
    const report = (payload) => {
        const state = payload.ok ? 'ok' : (payload.reason ?? 'unknown');
        if (state === lastState)
            return;
        lastState = state;
        const line = `[dsh-siliconflow-balance] ${state}`;
        if (payload.ok)
            console.info(line);
        else
            console.warn(line);
    };
    const remember = (payload) => {
        sample = { payload, expiresAt: Date.now() + cacheTtlMs };
        report(payload);
        return payload;
    };
    const forget = () => {
        sample = undefined;
        lastState = 'unknown';
    };
    /** The reading the pill polls: cached sample, shared in-flight call, or a fresh one. */
    const load = async () => {
        if (sample !== undefined && sample.expiresAt > Date.now())
            return sample.payload;
        if (inFlight !== undefined)
            return inFlight;
        inFlight = (async () => {
            try {
                const session = await storedSession(ctx, config);
                if (session === undefined) {
                    return remember(failurePayload(config, 'unconfigured', false));
                }
                let response;
                try {
                    response = await callConsole(config, session);
                }
                catch {
                    return remember(failurePayload(config, 'upstream', true));
                }
                return remember(await interpret(config, response));
            }
            finally {
                inFlight = undefined;
            }
        })();
        return inFlight;
    };
    const answer = (payload) => Response.json(payload, { headers: { 'cache-control': 'no-store' } });
    ctx.effect(() => ctx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async () => answer(await load()),
    }), 'dsh-siliconflow-balance: reading route');
    ctx.effect(() => ctx.connection.fetch.register({
        path: SESSION_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
            let input;
            try {
                input = parseSessionInput(await request.json());
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'invalid session';
                return answer({
                    ...failurePayload(config, 'invalid-response', false),
                    message,
                });
            }
            let probe;
            try {
                probe = await interpret(config, await callConsole(config, input));
            }
            catch {
                return answer({ ...failurePayload(config, 'upstream', false), message: 'console unreachable' });
            }
            if (!probe.ok) {
                return answer({ ...probe, configured: false });
            }
            try {
                await ctx.credentials.set(config.cookieRef, input.cookie);
                await ctx.credentials.set(config.subjectRef, input.subjectId);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'credential write failed';
                return answer({ ...failurePayload(config, 'storage', false), message });
            }
            forget();
            return answer(remember({ ...probe, configured: true }));
        },
    }), 'dsh-siliconflow-balance: session route');
    ctx.effect(() => ctx.connection.fetch.register({
        path: CLEAR_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async () => {
            for (const ref of [config.cookieRef, config.subjectRef]) {
                try {
                    await ctx.credentials.unset(ref);
                }
                catch {
                    /* already absent: nothing to forget */
                }
            }
            forget();
            return answer(remember(failurePayload(config, 'unconfigured', false)));
        },
    }), 'dsh-siliconflow-balance: clear route');
}
//# sourceMappingURL=index.js.map