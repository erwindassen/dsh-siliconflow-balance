/**
 * Wire payload for `GET /api/siliconflow.balance`.
 *
 * Shared by the Host route (`src/index.ts`) and the browser pill (`src/client.tsx`).
 * Keep this module free of runtime imports so both halves can use it.
 */
/** Why a payload carries no usable balance. */
export type BalanceFailure = 'unconfigured' | 'unauthorized' | 'upstream' | 'invalid-response';
/** CNY amounts parsed from SiliconFlow's `/v1/user/info` decimal strings. */
export interface BalanceAmounts {
    /** Granted / free credit: `data.balance`. */
    granted: number;
    /** Topped-up credit: `data.chargeBalance`. */
    charged: number;
    /** Sum of the two: `data.totalBalance`. */
    total: number;
}
/**
 * Presentation policy resolved on the Host and shipped with every payload.
 *
 * The browser half has no access to the Loader row's config, so the refresh
 * interval and the warning threshold travel with the answer instead of being
 * duplicated (and possibly drifting) in two places.
 */
export interface BalancePolicy {
    /** Client refresh interval while the page is visible, in seconds. */
    refreshSeconds: number;
    /** CNY threshold that turns the pill amber; `0` disables the warning. */
    warnThreshold: number;
    /** Whether the popover lists granted / topped-up rows. */
    showBreakdown: boolean;
}
export interface BalancePayload {
    ok: boolean;
    /** Present only when `ok` is false. */
    reason?: BalanceFailure;
    /** Present only when `ok` is true. */
    amounts?: BalanceAmounts;
    /** ISO-8601 time of the upstream sample that produced `amounts`. */
    asOf?: string;
    /** Upstream HTTP status for `unauthorized` / `upstream` failures. */
    upstreamStatus?: number;
    /** Presentation policy; always present on Host answers. */
    policy?: BalancePolicy;
}
//# sourceMappingURL=types.d.ts.map