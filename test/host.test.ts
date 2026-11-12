import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_PATH, apply, resolveConfig } from '../src/index.js';

const envelope = {
  code: 20000,
  message: 'OK',
  status: true,
  data: { balance: '0.88', chargeBalance: '88.00', totalBalance: '88.88' },
};

interface Route {
  path: string;
  methods: readonly string[];
  requestBody: string;
  fetch: (request: Request) => Promise<Response>;
}

function makeCtx(credential: string | undefined) {
  const routes: Route[] = [];
  const resolve = vi.fn(async (ref: string) =>
    credential === undefined ? undefined : { value: credential, ref },
  );
  const ctx = {
    connection: {
      fetch: {
        register: (route: Route) => {
          routes.push(route);
          return async () => {};
        },
      },
    },
    credentials: { resolve },
    effect: (callback: () => (() => unknown) | void) => {
      callback();
    },
  };
  return { ctx, routes, resolve };
}

function upstream(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

async function call(route: Route): Promise<Record<string, unknown>> {
  const response = await route.fetch(new Request(`http://127.0.0.1${ROUTE_PATH}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apply', () => {
  it('registers one GET route that never answers with a 5xx', async () => {
    vi.stubGlobal('fetch', upstream(200, envelope));
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe(ROUTE_PATH);
    expect(routes[0]?.methods).toEqual(['GET']);
    expect(routes[0]?.requestBody).toBe('buffered');
  });

  it('reports unconfigured when the credential is absent, without calling upstream', async () => {
    const fetchSpy = upstream(200, envelope);
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, routes } = makeCtx(undefined);
    apply(ctx, {});
    const body = await call(routes[0]!);
    expect(body['ok']).toBe(false);
    expect(body['reason']).toBe('unconfigured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the amounts and the policy on success', async () => {
    vi.stubGlobal('fetch', upstream(200, envelope));
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, { refreshSeconds: 120, warnThreshold: 5, showBreakdown: false });
    const body = await call(routes[0]!);
    expect(body['ok']).toBe(true);
    expect(body['amounts']).toEqual({ granted: 0.88, charged: 88, total: 88.88 });
    expect(body['policy']).toEqual({ refreshSeconds: 120, warnThreshold: 5, showBreakdown: false });
    expect(typeof body['asOf']).toBe('string');
    expect(JSON.stringify(body)).not.toContain('sk-test');
  });

  it('sends the credential as a Bearer token to /user/info', async () => {
    const fetchSpy = upstream(200, envelope);
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, { baseUrl: 'https://api.siliconflow.cn/v1/' });
    await call(routes[0]!);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.siliconflow.cn/v1/user/info');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer sk-test');
  });

  it('serves a cached sample inside the TTL', async () => {
    const fetchSpy = upstream(200, envelope);
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    await call(routes[0]!);
    await call(routes[0]!);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('shares one upstream call among concurrent requests', async () => {
    const fetchSpy = upstream(200, envelope);
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    const route = routes[0]!;
    await Promise.all([call(route), call(route), call(route)]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('maps 401 and 403 to unauthorized and does not cache them', async () => {
    vi.stubGlobal('fetch', upstream(401, { code: 30014, message: 'invalid token' }));
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    const body = await call(routes[0]!);
    expect(body['reason']).toBe('unauthorized');
    expect(body['upstreamStatus']).toBe(401);
  });

  it('reports the retired balance route as retired, not upstream', async () => {
    vi.stubGlobal(
      'fetch',
      upstream(410, {
        code: 20092,
        message: 'This endpoint is deprecated and is no longer available.',
        data: null,
      }),
    );
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    const body = await call(routes[0]!);
    expect(body['reason']).toBe('retired');
    expect(body['upstreamStatus']).toBe(410);
  });

  it('maps other upstream failures to upstream with the status', async () => {
    vi.stubGlobal('fetch', upstream(503, { message: 'maintenance' }));
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    const body = await call(routes[0]!);
    expect(body['reason']).toBe('upstream');
    expect(body['upstreamStatus']).toBe(503);
  });

  it('maps network errors and non-JSON bodies to a failure payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const offline = makeCtx('sk-test');
    apply(offline.ctx, {});
    expect((await call(offline.routes[0]!))['reason']).toBe('upstream');

    vi.stubGlobal('fetch', upstream(200, 'not json'));
    const broken = makeCtx('sk-test');
    apply(broken.ctx, {});
    expect((await call(broken.routes[0]!))['reason']).toBe('invalid-response');
  });

  it('treats a malformed envelope as invalid-response', async () => {
    vi.stubGlobal('fetch', upstream(200, { ...envelope, code: 30014 }));
    const { ctx, routes } = makeCtx('sk-test');
    apply(ctx, {});
    expect((await call(routes[0]!))['reason']).toBe('invalid-response');
  });
});

describe('resolveConfig', () => {
  it('applies defaults', () => {
    expect(resolveConfig(undefined)).toEqual({
      baseUrl: 'https://api.siliconflow.com/v1',
      credentialRef: 'SILICONFLOW_API_KEY',
      refreshSeconds: 300,
      showBreakdown: true,
      warnThreshold: 10,
    });
  });

  it('unwraps volatile accessors and clamps the refresh interval', () => {
    const config = resolveConfig({
      refreshSeconds: { get: () => 5 },
      showBreakdown: { get: () => false },
      warnThreshold: { get: () => 0 },
    });
    expect(config.refreshSeconds).toBe(30);
    expect(config.showBreakdown).toBe(false);
    expect(config.warnThreshold).toBe(0);
  });

  it('rejects a non-http base URL and malformed numbers', () => {
    const config = resolveConfig({ baseUrl: 'file:///etc', refreshSeconds: 'soon', warnThreshold: -3 });
    expect(config.baseUrl).toBe('https://api.siliconflow.com/v1');
    expect(config.refreshSeconds).toBe(300);
    expect(config.warnThreshold).toBe(10);
  });
});
