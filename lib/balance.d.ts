import type { BalanceAmounts } from './types.js';
/** Origin of the SiliconFlow console that owns the wallet service. */
export declare const CONSOLE_ORIGIN = "https://cloud.siliconflow.com";
/** Console page whose network traffic carries the wallet request. */
export declare const CONSOLE_PAGE_PATH = "/me/expensebill";
/** Wallet micro-service route. Paths are not public: found in the console traffic. */
export declare const WALLET_PEEK_PATH = "/walletd-server/api/v1/subject/profile/peek";
/** How long the Host waits for the console wallet service. */
export declare const UPSTREAM_TIMEOUT_MS = 10000;
/**
 * Wallet amounts are integer strings scaled by 1e12 per US dollar: the sample
 * capture's `5000000000000` is a $5.00 top-up and `654984326000` is $0.65 left.
 */
export declare const UNITS_PER_USD = 1000000000000;
/** The console answers a successful wallet request with this code. */
export declare const OK_CODE = 20000;
export interface WalletReading {
    amounts: BalanceAmounts;
    asOf: string;
}
/**
 * Scale a wallet integer string to US dollars.
 *
 * The scaling runs on the decimal string rather than with `BigInt` division so
 * that amounts beyond `Number.MAX_SAFE_INTEGER` still round to the nearest
 * double exactly once, instead of losing precision twice.
 */
export declare function unitsToUsd(value: unknown): number;
/** Decode the console wallet response into US-dollar amounts. */
export declare function parseWalletPeek(body: unknown): WalletReading;
/**
 * Format a US-dollar amount for the pill: `$88.88`.
 *
 * Sub-cent balances keep four decimals so a nearly empty wallet does not read
 * as `$0.00` while it can still pay for a call.
 */
export declare function formatUsd(amount: number): string;
/** Console origin plus the wallet route. */
export declare function peekUrl(baseUrl: string): string;
/** Console page the user pastes the session from. */
export declare function consolePageUrl(baseUrl: string): string;
//# sourceMappingURL=balance.d.ts.map