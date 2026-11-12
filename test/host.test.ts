import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLEAR_PATH,
  COOKIE_REF,
  ROUTE_PATH,
  SESSION_PATH,
  SUBJECT_REF,
  apply,
  parseSessionInput,
  resolveConfig,
} from '../src/index.js';

/** The console wallet response captured from the running account. */
const OK_ENVELOPE = {
  code: 20000,
  data: {
    financialInfo: {
      balance: '906696398000',
      available: '906696398000',
      recharged: '5000000000000',
      used: '4093303602000',
      lineOfCredit: '0',
      remainingCreditLine: '0',
    },
  },
};

const COOKIE = 'intercom-session-abc=1; intercom-device-id-abc=2';
const SUBJECT = 'dbksd38a55fc73cq8k2g';

interface Route {
  path: string;
  methods: readonly string[];
  requestBody: string;
  fetch: (request: Request) => Promise<Response>;
}

/** Install the Host half over stub services and hand back its routes. */
function harness(rawConfig: unknown = {}, stored: Record<string, string> = {}) {
  const routes = new Map<string, Route>();
  const credentials = new Map<string, string>(Object.entries(stored));
  const ctx = {
    effect: (setup: () => () => unknown) => {
      const dispose = setup();
      return () => {
        void dispose();
      };
    },
    connection: {
      fetch: {
        register(route: Route) {
          routes.set(route.path, route);
          return async () => {
            routes.delete(route.path);
          };
        },
      },
    },
    credentials: {
      async resolve(ref: string) {
        const value = credentials.get(ref);
        return value === undefined ? undefined : { value };
      },
      async set(ref: string, value: string) {
        credentials.set(ref, value);
      },
      async unset(ref: string) {
        credentials.delete(ref);
      },
    },
  };
  apply(ctx as never, rawConfig);
  return { routes, credentials };
}

/** Call a registered route with a GET request. */
async function get(routes: Map<string, Route>, path = ROUTE_PATH) {
  const route = routes.get(path);
  if (route === undefined) throw new Error(`route ${path} was not registered`);
  const response = await route.fetch(new Request(`http://127.0.0.1:52941${path}`));
  return (await response.json()) as Record<string, unknown>;
}

/** Call a registered route with a POST request. */
async function post(routes: Map<string, Route>, path: string, body?: unknown) {
  const route = routes.get(path);
  if (route === undefined) throw new Error(`route ${path} was not registered`);
  const response = await route.fetch(
    new Request(`http://127.0.0.1:52941${path}`, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return (await response.json()) as Record<string, unknown>;
}

/** Stub global fetch with one JSON answer. */
function upstream(answer: { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const spy = vi.fn(async () =>
    new Response(answer.body === undefined ? '' : JSON.stringify(answer.body), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json', ...answer.headers },
    }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('publishes the reading, session, and clear routes', () => {
    const { routes } = harness();
    expect([...routes.keys()].sort()).toEqual([CLEAR_PATH, ROUTE_PATH, SESSION_PATH].sort());
    expect(routes.get(ROUTE_PATH)?.methods).toEqual(['GET']);
    expect(routes.get(SESSION_PATH)?.methods).toEqual(['POST']);
    expect(routes.get(CLEAR_PATH)?.methods).toEqual(['POST']);
    for (const route of routes.values()) {
      expect(route.requestBody).toBe('buffered');
    }
  });

  it('answers no-store so the browser never caches the reading', async () => {
    upstream({ body: OK_ENVELOPE });
    const { routes } = harness();
    const response = await routes.get(ROUTE_PATH)!.fetch(new Request('http://127.0.0.1/x'));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('reading without a stored session', () => {
  it('reports unconfigured and never calls upstream', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes } = harness();
    const payload = await get(routes);
    expect(payload).toMatchObject({
      ok: false,
      reason: 'unconfigured',
      configured: false,
      policy: { refreshSeconds: 300, warnThreshold: 10, showBreakdown: true },
      consoleUrl: 'https://cloud.siliconflow.com/me/expensebill',
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('reading with a stored session', () => {
  it('returns the CNY amounts and hides the session from the payload', async () => {
    upstream({ body: OK_ENVELOPE });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    const payload = await get(routes);
    expect(payload).toMatchObject({
      ok: true,
      configured: true,
      amounts: { available: 906.696398, recharged: 5000, used: 4093.303602 },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('intercom-session');
    expect(serialized).not.toContain(SUBJECT);
    expect(Number.isNaN(Date.parse(String(payload.asOf)))).toBe(false);
  });

  it('sends the cookie and subject to the console wallet route', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    await get(routes);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek');
    expect(init.redirect).toBe('manual');
    const headers = init.headers as Record<string, string>;
    expect(headers.cookie).toBe(COOKIE);
    expect(headers['x-subject-id']).toBe(SUBJECT);
  });

  it('maps a console login redirect to an expired session', async () => {
    upstream({ status: 307, headers: { location: 'https://account.siliconflow.com/login' } });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    const payload = await get(routes);
    expect(payload).toMatchObject({
      ok: false,
      reason: 'unauthorized',
      upstreamStatus: 307,
      configured: true,
    });
  });

  it('maps 401 and 403 to an expired session', async () => {
    for (const status of [401, 403]) {
      vi.unstubAllGlobals();
      upstream({ status });
      const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
      expect(await get(routes)).toMatchObject({ reason: 'unauthorized', upstreamStatus: status });
    }
  });

  it('maps a server error to upstream', async () => {
    upstream({ status: 503 });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    expect(await get(routes)).toMatchObject({ reason: 'upstream', upstreamStatus: 503 });
  });

  it('maps a transport failure to upstream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    expect(await get(routes)).toMatchObject({ ok: false, reason: 'upstream' });
  });

  it('maps unparseable or unexpected bodies to invalid-response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>login</html>', { status: 200 })),
    );
    const first = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    expect(await get(first.routes)).toMatchObject({ reason: 'invalid-response' });

    vi.unstubAllGlobals();
    upstream({ body: { code: 20092, data: null } });
    const second = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    expect(await get(second.routes)).toMatchObject({ reason: 'invalid-response' });
  });

  it('caches the sample for repeated polls', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    await get(routes);
    await get(routes);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shares one upstream call between concurrent polls', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    await Promise.all([get(routes), get(routes), get(routes)]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('saving a pasted session', () => {
  it('stores the session only after the console admits it', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes, credentials } = harness();
    const payload = await post(routes, SESSION_PATH, { cookie: COOKIE, subjectId: SUBJECT });
    expect(payload).toMatchObject({
      ok: true,
      configured: true,
      amounts: { available: 906.696398 },
    });
    expect(credentials.get(COOKIE_REF)).toBe(COOKIE);
    expect(credentials.get(SUBJECT_REF)).toBe(SUBJECT);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).cookie).toBe(COOKIE);
  });

  it('refuses to store a session the console rejects', async () => {
    upstream({ status: 307, headers: { location: 'https://account.siliconflow.com/login' } });
    const { routes, credentials } = harness();
    const payload = await post(routes, SESSION_PATH, { cookie: COOKIE, subjectId: SUBJECT });
    expect(payload).toMatchObject({ ok: false, reason: 'unauthorized', upstreamStatus: 307 });
    expect(credentials.size).toBe(0);
  });

  it('rejects a malformed paste with a message and stores nothing', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes, credentials } = harness();
    const payload = await post(routes, SESSION_PATH, { cookie: '   ', subjectId: '' });
    expect(payload).toMatchObject({ ok: false, reason: 'invalid-response' });
    expect(String(payload.message)).toMatch(/cookie/);
    expect(credentials.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a storage failure instead of claiming success', async () => {
    upstream({ body: OK_ENVELOPE });
    const routes = new Map<string, Route>();
    const ctx = {
      effect: (setup: () => () => unknown) => {
        setup();
        return () => {};
      },
      connection: {
        fetch: {
          register(route: Route) {
            routes.set(route.path, route);
            return async () => {};
          },
        },
      },
      credentials: {
        async resolve() {
          return undefined;
        },
        async set() {
          throw new Error('read-only credential store');
        },
        async unset() {
          throw new Error('read-only credential store');
        },
      },
    };
    apply(ctx as never, {});
    const payload = await post(routes, SESSION_PATH, { cookie: COOKIE, subjectId: SUBJECT });
    expect(payload).toMatchObject({ ok: false, reason: 'storage' });
  });
});

describe('clearing the session', () => {
  it('forgets both credentials and reports unconfigured', async () => {
    const { routes, credentials } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    const payload = await post(routes, CLEAR_PATH);
    expect(payload).toMatchObject({ ok: false, reason: 'unconfigured', configured: false });
    expect(credentials.size).toBe(0);
  });

  it('survives clearing when nothing was stored', async () => {
    const { routes } = harness();
    expect(await post(routes, CLEAR_PATH)).toMatchObject({ reason: 'unconfigured' });
  });

  it('drops the cached sample so the next poll re-reads', async () => {
    const spy = upstream({ body: OK_ENVELOPE });
    const { routes } = harness({}, { [COOKIE_REF]: COOKIE, [SUBJECT_REF]: SUBJECT });
    await get(routes);
    await post(routes, CLEAR_PATH);
    expect(await get(routes)).toMatchObject({ reason: 'unconfigured' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('parseSessionInput', () => {
  it('accepts the pasted values and trims whitespace', () => {
    expect(parseSessionInput({ cookie: ` ${COOKIE} `, subjectId: ` ${SUBJECT} ` })).toEqual({
      cookie: COOKIE,
      subjectId: SUBJECT,
    });
  });

  it('rejects non-objects, empty cookies, and malformed subjects', () => {
    for (const body of [null, 'x', [], 7]) {
      expect(() => parseSessionInput(body)).toThrow();
    }
    expect(() => parseSessionInput({ cookie: '', subjectId: SUBJECT })).toThrow(/cookie/);
    expect(() => parseSessionInput({ cookie: 'no-equals-sign', subjectId: SUBJECT })).toThrow(/Cookie/);
    expect(() => parseSessionInput({ cookie: COOKIE, subjectId: 'ab' })).toThrow(/subject/);
    expect(() => parseSessionInput({ cookie: COOKIE, subjectId: 'has space' })).toThrow(/subject/);
  });
});

describe('resolveConfig', () => {
  it('applies the defaults', () => {
    expect(resolveConfig({})).toEqual({
      consoleBaseUrl: 'https://cloud.siliconflow.com',
      cookieRef: COOKIE_REF,
      subjectRef: SUBJECT_REF,
      refreshSeconds: 300,
      showBreakdown: true,
      warnThreshold: 10,
    });
  });

  it('unwraps volatile `{ get() }` fields', () => {
    const config = resolveConfig({
      refreshSeconds: { get: () => 120 },
      showBreakdown: { get: () => false },
      warnThreshold: { get: () => 25 },
    });
    expect(config.refreshSeconds).toBe(120);
    expect(config.showBreakdown).toBe(false);
    expect(config.warnThreshold).toBe(25);
  });

  it('clamps the refresh interval into [30, 3600]', () => {
    expect(resolveConfig({ refreshSeconds: 1 }).refreshSeconds).toBe(30);
    expect(resolveConfig({ refreshSeconds: 99_999 }).refreshSeconds).toBe(3600);
    expect(resolveConfig({ refreshSeconds: 'nope' }).refreshSeconds).toBe(300);
  });

  it('falls back for a hostile base URL and threshold', () => {
    expect(resolveConfig({ consoleBaseUrl: 'not a url' }).consoleBaseUrl).toBe(
      'https://cloud.siliconflow.com',
    );
    expect(resolveConfig({ warnThreshold: -5 }).warnThreshold).toBe(10);
    expect(resolveConfig({ warnThreshold: 'x' }).warnThreshold).toBe(10);
    expect(resolveConfig({ cookieRef: '  ' }).cookieRef).toBe(COOKIE_REF);
  });
});
