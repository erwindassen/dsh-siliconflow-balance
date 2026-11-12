import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * `apply` is the entry the Harness module loader calls. Nothing else exercises it,
 * so this suite drives it with a stub context: it must install the stylesheet once,
 * register both baseline dictionaries, and add the dock entry with a locale.
 */
type Effect = () => () => void;

let apply: typeof import('../src/client.js').apply;
let moduleName: string;
let inject: readonly string[];

beforeAll(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:52941/',
  });
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  const loaded = await import('../src/client.js');
  apply = loaded.apply;
  moduleName = loaded.name;
  inject = loaded.inject;
});

function stubContext() {
  const disposers: Effect[] = [];
  const registerLocale = vi.fn((ns: string, dicts: Record<string, unknown>) => () => {});
  const register = vi.fn((options: Record<string, unknown>, component: unknown) => () => {});
  const injectSlot = vi.fn((key: string, callback: () => () => void) => {
    callback();
    return () => {};
  });
  const ctx = {
    effect(callback: Effect) {
      disposers.push(callback());
    },
    locale: { register: registerLocale },
    slots: { inject: injectSlot, register },
  };
  return { ctx, disposers, registerLocale, register, injectSlot };
}

describe('client apply', () => {
  it('declares the services and the dock slot it needs', () => {
    expect(moduleName).toBe('dsh-siliconflow-balance');
    expect(inject).toEqual(['slots', 'locale']);
  });

  it('installs one stylesheet, registers zh+en, and adds the dock entry', () => {
    const { ctx, disposers, registerLocale, register, injectSlot } = stubContext();
    apply(ctx);

    const styles = document.head.querySelectorAll('style[data-dsh-siliconflow-balance]');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toContain('.dsfb_pill');
    expect(styles[0]!.textContent).toContain('--dsw-alias-state-warn-primary');

    expect(registerLocale).toHaveBeenCalledTimes(1);
    const [ns, dicts] = registerLocale.mock.calls[0]!;
    expect(ns).toBe('siliconflow-balance');
    expect(Object.keys(dicts).sort()).toEqual(['en', 'zh']);
    expect(Object.keys(dicts['en'] as Record<string, string>)).toEqual(
      Object.keys(dicts['zh'] as Record<string, string>),
    )

    expect(injectSlot).toHaveBeenCalledWith('conversation.composer.dock', expect.any(Function));
    expect(register).toHaveBeenCalledTimes(1);
    const [options] = register.mock.calls[0]!;
    expect(options).toMatchObject({
      name: 'conversation.composer.dock',
      id: 'siliconflow-balance',
      order: 2,
      locale: 'siliconflow-balance',
    });

    for (const dispose of disposers) dispose();
    expect(document.head.querySelectorAll('style[data-dsh-siliconflow-balance]')).toHaveLength(0);
  });
});
