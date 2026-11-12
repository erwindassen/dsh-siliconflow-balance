import type { BalanceAmounts } from './types.js';
/** Default vendor base URL; the CN deployment is `https://api.siliconflow.cn/v1`. */
export declare const DEFAULT_BASE_URL = "https://api.siliconflow.com/v1";
/**
 * Upstream request timeout. The Host route must answer quickly even when the
 * vendor is unreachable; the browser has its own interval and never blocks.
 */
export declare const UPSTREAM_TIMEOUT_MS = 10000;
/**
 * Parse the SiliconFlow `/v1/user/info` envelope into `BalanceAmounts`.
 *
 * The envelope is `{ code: 20000, message, status: true, data: { balance,
 * chargeBalance, totalBalance } }`; anything else is rejected so the Host can
 * report `invalid-response` instead of serving a half-trusted number.
 * See docs/design.md §3.
 */
export declare function parseUserInfo(body: unknown): BalanceAmounts;
/**
 * Format a CNY amount for the pill: two decimals and a `¥` prefix
 * (`88.88` → `¥88.88`). Intentionally locale-independent so the value reads
 * identically in every DSH locale and in the Host log.
 */
export declare function formatCny(amount: number): string;
/** Join a configured base URL with the vendor's balance endpoint. */
export declare function userInfoUrl(baseUrl: string): string;
//# sourceMappingURL=balance.d.ts.map