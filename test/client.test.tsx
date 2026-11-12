import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The client half talks to the Host route and renders the dock pill. This suite
 * mounts it in jsdom against a stubbed route so the state machine, the
 * `aria-expanded` contract, and the portaled popover are exercised for real
 * rather than asserted from source text.
 */
type Payload = Record<string, unknown>;

const OK: Payload = {
  ok: true,
  amounts: { granted: 0.88, charged: 88, total: 88.88 },
  asOf: '2026-11-12T16:00:00.000Z',
  policy: { refreshSeconds: 300, warnThreshold: 10, showBreakdown: true },
};

let dom: JSDOM;
let BalancePill: typeof import('../src/client.js').BalancePill;
let timerStub: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  // pretendToBeVisual is required: bare jsdom reports document.hidden === true, which
  // is exactly the "do not poll while hidden" condition the pill honours.
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:52941/',
    pretendToBeVisual: true,
  });
  const globals = globalThis as unknown as Record<string, unknown>;
  const define = (key: string, value: unknown) => {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  define('window', dom.window);
  define('document', dom.window.document);
  define('HTMLElement', dom.window.HTMLElement);
  define('Node', dom.window.Node);
  define('IS_REACT_ACT_ENVIRONMENT', true);
  void globals;
  ({ BalancePill } = await import('../src/client.js'));
});

let root: Root | undefined;
let container: HTMLElement;

function stubRoute(response: () => Promise<Response>) {
  const spy = vi.fn(response);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function okRoute(payload: Payload = OK) {
  return stubRoute(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

/** Let the mount effect's fetch promise chain settle inside act(). */
async function flush(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mount(): Promise<HTMLElement> {
  container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(BalancePill, {}));
  });
  await flush();
  return container;
}

function pill(): HTMLButtonElement {
  const node = container.querySelector<HTMLButtonElement>('button.dsfb_pill');
  if (!node) throw new Error('pill not rendered');
  return node;
}

function popover(): HTMLElement | null {
  return dom.window.document.body.querySelector<HTMLElement>('.dsfb_pop');
}

async function clickPill(): Promise<void> {
  await act(async () => {
    pill().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await flush(1);
}

beforeEach(() => {
  timerStub = vi.fn();
  void timerStub;
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BalancePill', () => {
  it('renders the total as a real button with aria-expanded="false"', async () => {
    const fetchSpy = okRoute();
    await mount();

    const button = pill();
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('data-state')).toBe('ok');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('¥88.88');
    expect(button.textContent).toContain('¥88.88');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(popover()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('opens a portaled breakdown popover on click and closes on Escape', async () => {
    okRoute();
    await mount();
    await clickPill();

    expect(pill().getAttribute('aria-expanded')).toBe('true');
    const panel = popover();
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain('Granted credit');
    expect(panel!.textContent).toContain('¥0.88');
    expect(panel!.textContent).toContain('¥88.00');
    expect(panel!.textContent).toContain('Refresh now');
    // Portaled: not inside the dock anchor.
    expect(container.querySelector('.dsfb_pop')).toBeNull();

    await act(async () => {
      dom.window.document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(popover()).toBeNull();
    expect(pill().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the popover on an outside pointerdown', async () => {
    okRoute();
    await mount();
    await clickPill();
    expect(popover()).not.toBeNull();

    await act(async () => {
      dom.window.document.body.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(popover()).toBeNull();
  });

  it('marks the pill low when the total is under the threshold', async () => {
    okRoute({
      ...OK,
      amounts: { granted: 0, charged: 5, total: 5 },
      policy: { refreshSeconds: 300, warnThreshold: 10, showBreakdown: true },
    });
    await mount();
    expect(pill().getAttribute('data-state')).toBe('low');
    await clickPill();
    expect(popover()!.textContent).toContain('Below the ¥10.00 warning threshold');
  });

  it('never turns amber when the threshold is disabled', async () => {
    okRoute({
      ...OK,
      amounts: { granted: 0, charged: 5, total: 5 },
      policy: { refreshSeconds: 300, warnThreshold: 0, showBreakdown: true },
    });
    await mount();
    expect(pill().getAttribute('data-state')).toBe('ok');
  });

  it('shows an empty pill when the key is not configured', async () => {
    okRoute({ ok: false, reason: 'unconfigured' } as Payload);
    await mount();
    expect(pill().getAttribute('data-state')).toBe('unconfigured');
    expect(pill().textContent).toContain('Balance —');
    await clickPill();
    expect(popover()!.textContent).toContain('SILICONFLOW_API_KEY is not configured');
  });

  it('keeps the last value and marks it stale when a refresh fails', async () => {
    let call = 0;
    stubRoute(async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify(OK), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: false, reason: 'upstream' }), { status: 200 });
    });
    await mount();
    expect(pill().getAttribute('data-state')).toBe('ok');

    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('focus'));
    });
    await flush();

    expect(pill().getAttribute('data-state')).toBe('stale');
    expect(pill().textContent).toContain('¥88.88');
    await clickPill();
    expect(popover()!.textContent).toContain('showing the last reading');
  });

  it('does not poll while the document is hidden, then refreshes when visible', async () => {
    let hidden = true;
    Object.defineProperty(dom.window.document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(dom.window.document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    const fetchSpy = okRoute();
    try {
      await mount();
      expect(pill().getAttribute('data-state')).toBe('loading');
      expect(fetchSpy).not.toHaveBeenCalled();

      hidden = false;
      await act(async () => {
        dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));
      });
      await flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(pill().getAttribute('data-state')).toBe('ok');
    } finally {
      delete (dom.window.document as unknown as Record<string, unknown>)['hidden'];
      delete (dom.window.document as unknown as Record<string, unknown>)['visibilityState'];
    }
  });

  it('explains a failed first read instead of claiming a stale value', async () => {
    okRoute({ ok: false, reason: 'upstream' } as Payload);
    await mount();
    expect(pill().getAttribute('data-state')).toBe('stale');
    expect(pill().textContent).toContain('Balance —');
    await clickPill();
    expect(popover()!.textContent).toContain('Could not read the balance');
    expect(popover()!.textContent).not.toContain('showing the last reading');
  });

  it('explains the retired balance endpoint and links to the console', async () => {
    okRoute({ ok: false, reason: 'retired', upstreamStatus: 410 } as Payload);
    await mount();
    expect(pill().getAttribute('data-state')).toBe('retired');
    expect(pill().getAttribute('title')).toContain('unavailable');
    await clickPill();
    const panel = popover()!;
    expect(panel.textContent).toContain('retired its balance endpoint on 2026-08-14');
    expect(panel.textContent).not.toContain('Reading the balance');
    expect(panel.textContent).not.toContain('Could not read the balance');
    const link = panel.querySelector<HTMLAnchorElement>('a.dsfb_link');
    expect(link?.getAttribute('href')).toBe('https://cloud.siliconflow.com/');
  });

  it('hides the breakdown rows when the Host policy disables them', async () => {
    okRoute({ ...OK, policy: { refreshSeconds: 300, warnThreshold: 10, showBreakdown: false } });
    await mount();
    await clickPill();
    const panel = popover()!;
    expect(panel.textContent).toContain('¥88.88');
    expect(panel.textContent).not.toContain('Granted credit');
  });
});
