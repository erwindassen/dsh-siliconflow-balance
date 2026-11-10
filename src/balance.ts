import type { BalanceAmounts } from './types.js';

/** Default vendor base URL; the CN deployment is `https://api.siliconflow.cn/v1`. */
export const DEFAULT_BASE_URL = 'https://api.siliconflow.com/v1';

/**
 * Parse the SiliconFlow `/v1/user/info` envelope into `BalanceAmounts`.
 *
 * The vendor returns balances as decimal *strings* (`"88.88"`), so reject anything
 * that is not a finite, non-negative decimal string. See docs/design.md §3.
 */
export function parseUserInfo(_body: unknown): BalanceAmounts {
  // TODO(implementation): validate `{ code: 20000, data: { balance, chargeBalance, totalBalance } }`.
  throw new Error('dsh-siliconflow-balance: parseUserInfo is not implemented yet');
}

/** Format a CNY amount for the pill: two decimals and a `¥` prefix (`88.88` → `¥88.88`). */
export function formatCny(_amount: number): string {
  // TODO(implementation): locale-independent `¥` + fixed two-decimal formatting.
  throw new Error('dsh-siliconflow-balance: formatCny is not implemented yet');
}
