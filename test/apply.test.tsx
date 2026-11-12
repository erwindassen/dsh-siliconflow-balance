import { createElement } from 'react';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('client apply', () => {
  let apply: (ctx: unknown) => void;
  let clientName: string;
  let clientInject: string[];

  beforeAll(async () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'http://127.0.0.1:52941/',
    });
    const g = globalThis as unknown as Record<string, unknown>;
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'] as const) {
      Object.defineProperty(g, key, {
        configurable: true,
        writable: true,
        value: (dom.window as unknown as Record<string, unknown>)[key],
      });
    }
    const module = await import('../src/client.js');
    apply = module.apply;
    clientName = module.name;
    clientInject = module.inject as string[];
  });

  function harness() {
    const disposers: Array<() => void> = [];
    const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = [];
    const injected: string[] = [];
    const dictionaries: Array<{ ns: string; dicts: Record<string, Record<string, string>> }> = [];
    const ctx = {
      effect(setup: () => (() => void) | void) {
        const dispose = setup();
        if (typeof dispose === 'function') disposers.push(dispose);
        return () => {};
      },
      locale: {
        register(ns: string, dicts: Record<string, Record<string, string>>) {
          dictionaries.push({ ns, dicts });
          return () => {};
        },
        bind: () => (key: string) => key,
      },
      slots: {
        inject(ownerKey: string, callback: () => unknown) {
          injected.push(ownerKey);
          callback();
          return () => {};
        },
        register(options: Record<string, unknown>, component: unknown) {
          registrations.push({ options, component });
          return () => {};
        },
      },
    };
    apply(ctx);
    return { disposers, registrations, injected, dictionaries };
  }

  it('exposes the module contract the loader expects', () => {
    expect(clientName).toBe('dsh-siliconflow-balance');
    expect(clientInject).toEqual(['slots', 'locale']);
  });

  it('installs one stylesheet into the document head', () => {
    document.head.innerHTML = '';
    harness();
    const tags = document.head.querySelectorAll('style[data-dsh-siliconflow-balance]');
    expect(tags).toHaveLength(1);
    const css = tags[0]!.textContent ?? '';
    expect(css).toContain('.dsfb_pill');
    expect(css).toContain('--dsw-alias-state-warn-primary');
  });

  it('removes the stylesheet through its disposer', () => {
    document.head.innerHTML = '';
    const { disposers } = harness();
    expect(document.head.querySelector('style[data-dsh-siliconflow-balance]')).not.toBeNull();
    for (const dispose of disposers) dispose();
    expect(document.head.querySelector('style[data-dsh-siliconflow-balance]')).toBeNull();
  });

  it('registers a zh and en dictionary with matching keys', () => {
    document.head.innerHTML = '';
    const { dictionaries } = harness();
    expect(dictionaries).toHaveLength(1);
    const { ns, dicts } = dictionaries[0]!;
    expect(ns).toBe('siliconflow-balance');
    expect(Object.keys(dicts).sort()).toEqual(['en', 'zh']);
    expect(Object.keys(dicts.zh).sort()).toEqual(Object.keys(dicts.en).sort());
    for (const key of ['pop.unconfigured', 'settings.save', 'pill.empty']) {
      expect(dicts.en[key]).toBeTruthy();
      expect(dicts.zh[key]).toBeTruthy();
    }
  });

  it('seats the pill in the composer dock after the usage pill', () => {
    document.head.innerHTML = '';
    const { registrations, injected } = harness();
    expect(injected).toContain('conversation.composer.dock');
    const dock = registrations.find((entry) => entry.options.name === 'conversation.composer.dock');
    expect(dock?.options).toMatchObject({
      id: 'siliconflow-balance',
      order: 2,
      locale: 'siliconflow-balance',
    });
    expect(typeof dock?.component).toBe('function');
  });

  it('adds a settings section with the plugin title as its label', () => {
    document.head.innerHTML = '';
    const { registrations, injected } = harness();
    expect(injected).toContain('settings.section');
    const section = registrations.find((entry) => entry.options.name === 'settings.section');
    expect(section?.options).toMatchObject({
      id: 'siliconflow-balance',
      order: 100,
      locale: 'siliconflow-balance',
    });
    expect(typeof (section!.options.label as () => string)).toBe('function');
    expect(typeof section?.component).toBe('function');
    // The section renders the paste form rather than a schema form.
    expect(createElement(section!.component as never, { tr: (key: string) => key })).toBeTruthy();
  });

  it('does not add DOM outside the head before a component renders', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    harness();
    expect(document.body.children).toHaveLength(0);
    expect(document.head.children).toHaveLength(1);
  });

  it('never touches document.body with the stylesheet', () => {
    document.head.innerHTML = '';
    harness();
    expect(document.body.querySelector('style[data-dsh-siliconflow-balance]')).toBeNull();
  });

  it('registers exactly two slots', () => {
    document.head.innerHTML = '';
    const { registrations } = harness();
    expect(registrations).toHaveLength(2);
    expect(registrations.map((entry) => entry.options.name).sort()).toEqual([
      'conversation.composer.dock',
      'settings.section',
    ]);
  });

  it('binds the locale namespace for labels', () => {
    document.head.innerHTML = '';
    const bind = vi.fn(() => (key: string) => key);
    const ctx = {
      effect: () => () => {},
      locale: { register: () => () => {}, bind },
      slots: { inject: () => () => {}, register: () => () => {} },
    };
    apply(ctx);
    expect(bind).toHaveBeenCalledWith('siliconflow-balance');
  });
});
