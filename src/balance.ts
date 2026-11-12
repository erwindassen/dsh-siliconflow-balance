import type { BalanceAmounts } from './types.js';

/** Origin of the SiliconFlow console that owns the wallet service. */
export const CONSOLE_ORIGIN = 'https://cloud.siliconflow.com';

/** Console page whose network traffic carries the wallet request. */
export const CONSOLE_PAGE_PATH = '/me/expensebill';

/** Wallet micro-service route. Paths are not public: found in the console traffic. */
export const WALLET_PEEK_PATH = '/walletd-server/api/v1/subject/profile/peek';

/** How long the Host waits for the console wallet service. */
export const UPSTREAM_TIMEOUT_MS = 10_000;

/** Wallet amounts are integer strings in nano-yuan (1e-9 CNY). */
export const NANO_UNITS_PER_CNY = 1_000_000_000;

/** The console answers a successful wallet request with this code. */
export const OK_CODE = 20000;

const UINTEGER = /^(?:0|[1-9]\d*)$/;

export interface WalletReading {
  amounts: BalanceAmounts;
  asOf: string;
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value as Record<string, unknown>;
}

/**
 * Scale a nano-yuan integer string to CNY.
 *
 * The division is done on the decimal string rather than with `BigInt` division
 * so that amounts beyond `Number.MAX_SAFE_INTEGER` still round to the nearest
 * double exactly once, instead of losing precision twice.
 */
export function nanoToCny(value: unknown): number {
  if (typeof value !== 'string' || !UINTEGER.test(value)) {
    throw new Error(`amount is not an unsigned integer string: ${String(value)}`);
  }
  const digits = value.padStart(10, '0');
  const whole = digits.slice(0, -9).replace(/^0+(?=\d)/, '');
  const fraction = digits.slice(-9).replace(/0+$/, '');
  return Number(fraction === '' ? whole : `${whole}.${fraction}`);
}

/** Decode the console wallet response into CNY amounts. */
export function parseWalletPeek(body: unknown): WalletReading {
  const envelope = asRecord(body, 'wallet response');
  if (envelope.code !== OK_CODE) {
    throw new Error(`wallet response code is ${String(envelope.code)}, expected ${OK_CODE}`);
  }
  const data = asRecord(envelope.data, 'wallet response data');
  const financialInfo = asRecord(data.financialInfo, 'wallet response financialInfo');
  const amounts: BalanceAmounts = {
    available: nanoToCny(financialInfo.available),
    recharged: nanoToCny(financialInfo.recharged),
    used: nanoToCny(financialInfo.used),
  };
  return { amounts, asOf: new Date().toISOString() };
}

/** Format a CNY amount for the pill: `¥88.88`. */
export function formatCny(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error(`amount is not finite: ${String(amount)}`);
  return `¥${amount.toFixed(2)}`;
}

function originOf(baseUrl: string): string {
  const origin = baseUrl.trim().replace(/\/+$/, '');
  if (origin === '') throw new Error('console base URL is empty');
  return origin;
}

/** Console origin plus the wallet route. */
export function peekUrl(baseUrl: string): string {
  return `${originOf(baseUrl)}${WALLET_PEEK_PATH}`;
}

/** Console page the user pastes the session from. */
export function consolePageUrl(baseUrl: string): string {
  return `${originOf(baseUrl)}${CONSOLE_PAGE_PATH}`;
}
