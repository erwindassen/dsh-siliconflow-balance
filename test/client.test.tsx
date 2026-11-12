import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:52941/',
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'MouseEvent',
  'DOMRect',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const) {
  const value = (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(g, key, { configurable: true, writable: true, value });
}
Object.defineProperty(g, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });

const { BalancePill, dictionaries } = await import('../src/client.js');
const EN = dictionaries.en as Record<string, string>;

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

const POLICY = { refreshSeconds: 300, warnThreshold: 10, showBreakdown: true };
const CONSOLE_URL = 'https://cloud.siliconflow.com/me/expensebill';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    configured: true,
    amounts: { available: 906.696398, recharged: 5000, used: 4093.3036 },
    asOf: '2026-11-12T17:09:39.000Z',
    policy: POLICY,
    consoleUrl: CONSOLE_URL,
    ...overrides,
  };
}

function answer(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubRoute(handler: () => Promise<Response>) {
  const spy = vi.fn(handler);
  vi.stubGlobal('fetch', spy);
  return spy;
}

const tr = (key: string, params?: Record<string, unknown>): string =>
  interpolate(EN[key] ?? key, params);

let container: HTMLElement;
let root: Root | undefined;

function mount() {
  container = document.getElementById('root') as HTMLElement;
  container.innerHTML = '';
  root = createRoot(container);
  act(() => {
    root!.render(createElement(BalancePill, { tr }));
  });
}

async function flush(rounds = 5) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function pill(): HTMLElement {
  const found = container.querySelector('.dsfb_pill');
  if (found === null) throw new Error('pill is not rendered');
  return found as HTMLElement;
}

function popover(): HTMLElement | null {
  return document.querySelector('.dsfb_pop');
}

async function clickPill() {
  await act(async () => {
    pill().click();
  });
}

beforeEach(() => {
  root = undefined;
});

afterEach(async () => {
  if (root !== undefined) {
    const current = root;
    root = undefined;
    await act(async () => {
      current.unmount();
    });
  }
  document.querySelectorAll('.dsfb_pop').forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

describe('composer pill', () => {
  it('shows the available balance once the reading arrives', async () => {
    const spy = stubRoute(async () => answer(payload()));
    mount();
    await flush();
    expect(pill().textContent).toBe('¥906.70');
    expect(pill().dataset.state).toBe('ok');
    expect(pill().getAttribute('aria-expanded')).toBe('false');
    expect(pill().getAttribute('aria-haspopup')).toBe('dialog');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('opens a popover with the breakdown and closes on Escape', async () => {
    stubRoute(async () => answer(payload()));
    mount();
    await flush();

    await clickPill();
    expect(pill().getAttribute('aria-expanded')).toBe('true');
    const pop = popover();
    expect(pop).not.toBeNull();
    expect(pop!.textContent).toContain('¥906.70');
    expect(pop!.textContent).toContain('¥5000.00');
    expect(pop!.textContent).toContain('¥4093.30');
    expect(pop!.parentElement).toBe(document.body);

    await act(async () => {
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(popover()).toBeNull();
  });

  it('closes on an outside pointer press but stays open on an inside one', async () => {
    stubRoute(async () => answer(payload()));
    mount();
    await flush();
    await clickPill();

    await act(async () => {
      popover()!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    });
    expect(popover()).not.toBeNull();

    await act(async () => {
      document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    });
    expect(popover()).toBeNull();
  });

  it('turns amber below the warning threshold', async () => {
    stubRoute(async () =>
      answer(payload({ amounts: { available: 5, recharged: 100, used: 95 } })),
    );
    mount();
    await flush();
    expect(pill().dataset.state).toBe('low');
    await clickPill();
    expect(popover()!.textContent).toContain('Below the ¥10.00 warning threshold');
  });

  it('keeps the normal state when the threshold is disabled', async () => {
    stubRoute(async () =>
      answer(
        payload({
          amounts: { available: 5, recharged: 100, used: 95 },
          policy: { ...POLICY, warnThreshold: 0 },
        }),
      ),
    );
    mount();
    await flush();
    expect(pill().dataset.state).toBe('ok');
  });

  it('explains that no console session is saved yet', async () => {
    stubRoute(async () =>
      answer(payload({ ok: false, reason: 'unconfigured', configured: false, amounts: undefined })),
    );
    mount();
    await flush();
    expect(pill().textContent).toBe(tr('pill.empty'));
    expect(pill().dataset.state).toBe('unconfigured');
    await clickPill();
    expect(popover()!.textContent).toContain('No console session saved yet');
  });

  it('marks an expired session distinctly', async () => {
    stubRoute(async () => answer(payload({ ok: false, reason: 'unauthorized', configured: true, amounts: undefined })));
    mount();
    await flush();
    expect(pill().dataset.state).toBe('unauthorized');
    expect(pill().getAttribute('aria-label')).toBe(EN['pill.expiredAria']);
  });

  it('keeps the last reading when a refresh fails', async () => {
    let call = 0;
    stubRoute(async () => {
      call += 1;
      if (call === 1) return answer(payload());
      throw new TypeError('fetch failed');
    });
    mount();
    await flush();
    expect(pill().textContent).toBe('¥906.70');

    await act(async () => {
      dom.window.dispatchEvent(new dom.window.Event('focus'));
    });
    await flush();
    expect(pill().textContent).toBe('¥906.70');
    expect(pill().dataset.state).toBe('stale');
    await clickPill();
    expect(popover()!.textContent).toContain('Could not refresh');
  });

  it('does not poll while the document is hidden', async () => {
    const spy = stubRoute(async () => answer(payload()));
    mount();
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await act(async () => {
      document.dispatchEvent(new dom.window.Event('visibilitychange'));
    });
    expect(spy).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    await act(async () => {
      document.dispatchEvent(new dom.window.Event('visibilitychange'));
    });
    await flush();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reports a total failure without a prior reading', async () => {
    stubRoute(async () => {
      throw new TypeError('fetch failed');
    });
    mount();
    await flush();
    expect(pill().textContent).toBe(tr('pill.empty'));
    expect(pill().dataset.state).toBe('error');
    await clickPill();
    expect(popover()!.textContent).toContain('Could not read the balance');
  });

  it('hides the breakdown when the policy asks for it', async () => {
    stubRoute(async () => answer(payload({ policy: { ...POLICY, showBreakdown: false } })));
    mount();
    await flush();
    await clickPill();
    const pop = popover()!;
    expect(pop.textContent).not.toContain('Available');
    expect(pop.textContent).not.toContain('¥5000.00');
  });
});
