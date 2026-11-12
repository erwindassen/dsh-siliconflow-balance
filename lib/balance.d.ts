import type { BalanceAmounts } from './types.js';
/** Origin of the SiliconFlow console that owns the wallet service. */
export declare const CONSOLE_ORIGIN = "https://cloud.siliconflow.com";
/** Console page whose network traffic carries the wallet request. */
export declare const CONSOLE_PAGE_PATH = "/me/expensebill";
/** Wallet micro-service route. Paths are not public: found in the console traffic. */
export declare const WALLET_PEEK_PATH = "/walletd-server/api/v1/subject/profile/peek";
/** How long the Host waits for the console wallet service. */
export declare const UPSTREAM_TIMEOUT_MS = 10000;
/** Wallet amounts are integer strings in nano-yuan (1e-9 CNY). */
export declare const NANO_UNITS_PER_CNY = 1000000000;
/** The console answers a successful wallet request with this code. */
export declare const OK_CODE = 20000;
export interface WalletReading {
    amounts: BalanceAmounts;
    asOf: string;
}
/**
 * Scale a nano-yuan integer string to CNY.
 *
 * The division is done on the decimal string rather than with `BigInt` division
 * so that amounts beyond `Number.MAX_SAFE_INTEGER` still round to the nearest
 * double exactly once, instead of losing precision twice.
 */
export declare function nanoToCny(value: unknown): number;
/** Decode the console wallet response into CNY amounts. */
export declare function parseWalletPeek(body: unknown): WalletReading;
/** Format a CNY amount for the pill: `¥88.88`. */
export declare function formatCny(amount: number): string;
/** Console origin plus the wallet route. */
export declare function peekUrl(baseUrl: string): string;
/** Console page the user pastes the session from. */
export declare function consolePageUrl(baseUrl: string): string;
//# sourceMappingURL=balance.d.ts.map