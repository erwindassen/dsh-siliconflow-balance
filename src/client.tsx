/**
 * Browser half of dsh-siliconflow-balance.
 *
 * Registers a compact pill in the composer dock that shows the SiliconFlow
 * account balance. The API key never reaches the browser: the pill reads the
 * Host route `/api/siliconflow.balance`, which owns the credential and the
 * upstream cache. The popover is portaled to `document.body` because the
 * docked composer clips fixed overlays.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCny } from './balance.js';
import type { BalanceAmounts, BalanceFailure, BalancePayload, BalancePolicy } from './types.js';

const NS = 'siliconflow-balance';
const ROUTE = '/api/siliconflow.balance';
const MIN_REFRESH_MS = 15_000;
const POPOVER_WIDTH = 252;
const POPOVER_EDGE = 8;

const DEFAULT_POLICY: BalancePolicy = {
  refreshSeconds: 300,
  warnThreshold: 10,
  showBreakdown: true,
};

const ZH: Record<string, string> = {
  'pill.loading': '余额 …',
  'pill.empty': '余额 —',
  'pill.aria': '硅基流动余额：{amount}',
  'pop.title': '硅基流动余额',
  'pop.granted': '赠送额度',
  'pop.charged': '充值余额',
  'pop.total': '总额',
  'pop.updated': '更新于 {time}',
  'pop.pending': '正在读取余额…',
  'pop.low': '余额低于提醒阈值 {threshold}',
  'pop.stale': '刷新失败，显示的是上次读取的数据',
  'pop.error': '读取余额失败，请稍后重试。',
  'pop.unconfigured': '尚未配置 SILICONFLOW_API_KEY，请在设置中添加。',
  'pop.unauthorized': 'API Key 被拒绝，请在设置中检查 SILICONFLOW_API_KEY。',
  'pop.refresh': '立即刷新',
};

const EN: Record<string, string> = {
  'pill.loading': 'Balance …',
  'pill.empty': 'Balance —',
  'pill.aria': 'SiliconFlow balance: {amount}',
  'pop.title': 'SiliconFlow balance',
  'pop.granted': 'Granted credit',
  'pop.charged': 'Topped-up credit',
  'pop.total': 'Total',
  'pop.updated': 'Updated {time}',
  'pop.pending': 'Reading the balance…',
  'pop.low': 'Below the {threshold} warning threshold',
  'pop.stale': 'Could not refresh — showing the last reading',
  'pop.error': 'Could not read the balance. Try again in a moment.',
  'pop.unconfigured': 'SILICONFLOW_API_KEY is not configured. Add it in Settings.',
  'pop.unauthorized': 'The API key was rejected. Check SILICONFLOW_API_KEY in Settings.',
  'pop.refresh': 'Refresh now',
};

type Translate = (key: string, params?: Record<string, unknown>) => string;
type PillState = 'loading' | 'ok' | 'low' | 'stale' | 'unconfigured' | 'unauthorized';

interface Sample {
  amounts: BalanceAmounts;
  asOf: string;
}

interface PopoverPosition {
  right: number;
  bottom?: number;
  top?: number;
}

export interface BalancePillProps {
  /** Provided by the runtime for slots registered with a `locale`. */
  t?: Translate;
  sessionId?: string;
}

interface ClientContext {
  slots: {
    inject(key: string, callback: () => () => void): () => void;
    register(options: Record<string, unknown>, component: (props: BalancePillProps) => unknown): () => void;
  };
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void;
  };
  effect(callback: () => () => void, label?: string): void;
}

function interpolate(text: string, params?: Record<string, unknown>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

function fallbackTranslate(key: string, params?: Record<string, unknown>): string {
  return interpolate(EN[key] ?? key, params);
}

function formatClock(asOf: string): string {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return asOf;
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return asOf;
  }
}

function BalanceIcon(): JSX.Element {
  return (
    <svg className="dsfb_icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <ellipse cx="8" cy="4.4" rx="4.3" ry="1.9" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.7 4.4v3.1c0 1.05 1.92 1.9 4.3 1.9s4.3-.85 4.3-1.9V4.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.7 7.5v3.1c0 1.05 1.92 1.9 4.3 1.9s4.3-.85 4.3-1.9V7.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** True when the browser reports a usable viewport width. */
function viewportWidth(): number {
  return typeof window === 'undefined' ? POPOVER_WIDTH + 2 * POPOVER_EDGE : window.innerWidth;
}

export function BalancePill(props: BalancePillProps): JSX.Element {
  const translate = typeof props.t === 'function' ? props.t : fallbackTranslate;
  const tr = (key: string, params?: Record<string, unknown>) => translate(key, params);

  const [sample, setSample] = useState<Sample | null>(null);
  const [failure, setFailure] = useState<BalanceFailure | null>(null);
  const [settled, setSettled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<BalancePolicy>(DEFAULT_POLICY);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ right: POPOVER_EDGE });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const policyRef = useRef<BalancePolicy>(DEFAULT_POLICY);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const schedule = () => {
      clearTimer();
      if (disposed || typeof document === 'undefined' || document.hidden) return;
      const interval = Math.max(MIN_REFRESH_MS, policyRef.current.refreshSeconds * 1000);
      timer = setTimeout(() => {
        timer = undefined;
        void load();
      }, interval);
    };

    const load = async () => {
      // At most one request in flight; ticks that land meanwhile are dropped.
      if (disposed || inFlight) return;
      inFlight = true;
      setBusy(true);
      try {
        const response = await fetch(ROUTE, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        if (disposed) return;
        if (!response.ok) {
          setFailure('upstream');
          setSettled(true);
          return;
        }
        const payload = (await response.json()) as BalancePayload;
        if (disposed) return;
        if (payload.policy) {
          policyRef.current = payload.policy;
          setPolicy(payload.policy);
        }
        if (payload.ok && payload.amounts) {
          setSample({ amounts: payload.amounts, asOf: payload.asOf ?? new Date().toISOString() });
          setFailure(null);
        } else {
          setFailure(payload.reason ?? 'upstream');
        }
        setSettled(true);
      } catch {
        if (!disposed) {
          setFailure('upstream');
          setSettled(true);
        }
      } finally {
        inFlight = false;
        if (!disposed) {
          setBusy(false);
          schedule();
        }
      }
    };

    refreshRef.current = () => {
      clearTimer();
      void load();
    };

    // A focus or visibility regain revalidates immediately; the popover may stay open.
    const wake = () => {
      if (disposed) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      clearTimer();
      void load();
    };

    if (typeof document !== 'undefined' && !document.hidden) void load();
    else schedule();

    const onVisibility = () => {
      if (document.hidden) clearTimer();
      else wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', wake);

    return () => {
      disposed = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', wake);
    };
  }, []);

  const state: PillState = (() => {
    if (failure === 'unconfigured') return 'unconfigured';
    if (failure === 'unauthorized') return 'unauthorized';
    if (failure) return 'stale';
    if (!settled) return 'loading';
    if (sample && policy.warnThreshold > 0 && sample.amounts.total < policy.warnThreshold) return 'low';
    return 'ok';
  })();

  const amountLabel = sample ? formatCny(sample.amounts.total) : undefined;
  const label =
    state === 'loading'
      ? tr('pill.loading')
      : amountLabel ?? tr('pill.empty');
  const ariaLabel = tr('pill.aria', { amount: label });

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, viewportWidth() - 2 * POPOVER_EDGE);
    const right = Math.max(
      POPOVER_EDGE,
      Math.min(viewportWidth() - rect.right, viewportWidth() - width - POPOVER_EDGE),
    );
    if (rect.top >= 240) {
      setPosition({ right, bottom: Math.max(POPOVER_EDGE, window.innerHeight - rect.top + POPOVER_EDGE) });
    } else {
      setPosition({ right, top: Math.min(window.innerHeight - POPOVER_EDGE, rect.bottom + POPOVER_EDGE) });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const popover = open
    ? createPortal(
        <div
          ref={popoverRef}
          className="dsfb_pop"
          role="dialog"
          aria-label={tr('pop.title')}
          style={{ right: position.right, bottom: position.bottom, top: position.top }}
        >
          <div className="dsfb_pop_head">
            <span className="dsfb_pop_title">{tr('pop.title')}</span>
            <span className="dsfb_pop_total">{amountLabel ?? tr('pill.empty')}</span>
          </div>
          {sample && policy.showBreakdown ? (
            <div className="dsfb_rows">
              <div className="dsfb_row">
                <span>{tr('pop.granted')}</span>
                <span className="dsfb_value">{formatCny(sample.amounts.granted)}</span>
              </div>
              <div className="dsfb_row">
                <span>{tr('pop.charged')}</span>
                <span className="dsfb_value">{formatCny(sample.amounts.charged)}</span>
              </div>
              <div className="dsfb_row">
                <span>{tr('pop.total')}</span>
                <span className="dsfb_value">{formatCny(sample.amounts.total)}</span>
              </div>
            </div>
          ) : null}
          <div className="dsfb_note">
            {sample ? tr('pop.updated', { time: formatClock(sample.asOf) }) : tr('pop.pending')}
          </div>
          {state === 'low' ? (
            <div className="dsfb_note" data-tone="warn">
              {tr('pop.low', { threshold: formatCny(policy.warnThreshold) })}
            </div>
          ) : null}
          {state === 'stale' && sample ? (
            <div className="dsfb_note" data-tone="warn">
              {tr('pop.stale')}
            </div>
          ) : null}
          {state === 'stale' && !sample ? (
            <div className="dsfb_note" data-tone="warn">
              {tr('pop.error')}
            </div>
          ) : null}
          {state === 'unconfigured' ? (
            <div className="dsfb_note" data-tone="warn">
              {tr('pop.unconfigured')}
            </div>
          ) : null}
          {state === 'unauthorized' ? (
            <div className="dsfb_note" data-tone="error">
              {tr('pop.unauthorized')}
            </div>
          ) : null}
          <div className="dsfb_actions">
            <button
              type="button"
              className="dsfb_action"
              disabled={busy}
              onClick={() => refreshRef.current()}
            >
              {tr('pop.refresh')}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <span className="dsfb_anchor" data-composer-stat={NS}>
      <button
        ref={buttonRef}
        type="button"
        className="dsfb_pill"
        data-state={state}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
      >
        {state === 'stale' ? <span className="dsfb_dot" aria-hidden="true" /> : <BalanceIcon />}
        <span className="dsfb_label">{label}</span>
      </button>
      {popover}
    </span>
  );
}

const CSS = `
.dsfb_anchor {
  min-width: 0;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
  display: inline-flex;
}
.dsfb_pill {
  border-radius: var(--dsw-radius-sm);
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  background: 0 0;
  border: none;
  align-items: center;
  gap: 6px;
  padding: 1px 8px;
  display: inline-flex;
  cursor: pointer;
  transition: color .15s ease;
}
.dsfb_pill:hover { color: var(--dsw-alias-label-secondary); }
.dsfb_pill:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsfb_pill[data-state='loading'] { color: var(--dsw-alias-state-idle-primary); }
.dsfb_pill[data-state='low'] { color: var(--dsw-alias-state-warn-primary); }
.dsfb_pill[data-state='stale'],
.dsfb_pill[data-state='unconfigured'],
.dsfb_pill[data-state='unauthorized'] { color: var(--dsw-alias-label-tertiary); }
.dsfb_icon { width: 14px; height: 14px; flex: none; }
.dsfb_dot { width: 6px; height: 6px; border-radius: 999px; flex: none; margin: 0 4px; background: var(--dsw-alias-state-idle-primary); }
.dsfb_label { text-overflow: ellipsis; min-width: 0; overflow: hidden; }
.dsfb_pop {
  position: fixed;
  z-index: 10000;
  width: 252px;
  max-height: calc(100vh - 24px);
  overflow: auto;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1));
  border: 1px solid var(--dsw-alias-border-l1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: 1.5;
}
.dsfb_pop_head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.dsfb_pop_title { font-weight: 600; color: var(--dsw-alias-label-primary); }
.dsfb_pop_total { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.dsfb_rows { display: flex; flex-direction: column; gap: 2px; }
.dsfb_row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-secondary); }
.dsfb_value { font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary); }
.dsfb_note { margin-top: 8px; color: var(--dsw-alias-label-tertiary); }
.dsfb_note[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary); }
.dsfb_note[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }
.dsfb_actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.dsfb_action {
  appearance: none;
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  padding: 3px 10px;
  font: inherit;
  cursor: pointer;
}
.dsfb_action:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsfb_action:disabled { opacity: .5; cursor: default; }
`;

/** Append the pill stylesheet once per page and remove it with the plugin. */
function installStyles(): () => void {
  if (typeof document === 'undefined') return () => {};
  const tag = document.createElement('style');
  tag.dataset['dshSiliconflowBalance'] = '1';
  tag.textContent = CSS;
  document.head.append(tag);
  return () => {
    tag.remove();
  };
}

export const name = 'dsh-siliconflow-balance';

export const inject = ['slots', 'locale'];

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installStyles(), 'dsh-siliconflow-balance: styles');
  ctx.effect(
    () => ctx.locale.register(NS, { zh: ZH, en: EN }),
    'dsh-siliconflow-balance: dictionaries',
  );
  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      { name: 'conversation.composer.dock', id: 'siliconflow-balance', order: 2, locale: NS },
      BalancePill,
    ),
  );
}
