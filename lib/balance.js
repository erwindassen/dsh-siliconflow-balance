/** Default vendor base URL; the CN deployment is `https://api.siliconflow.cn/v1`. */
export const DEFAULT_BASE_URL = 'https://api.siliconflow.com/v1';
/**
 * Upstream request timeout. The Host route must answer quickly even when the
 * vendor is unreachable; the browser has its own interval and never blocks.
 */
export const UPSTREAM_TIMEOUT_MS = 10_000;
/**
 * SiliconFlow returns balances as decimal *strings* (`"88.88"`). `1e3`, `+1`,
 * `.5`, `1,000` and negative values are all rejected: none of them is a legal
 * money literal in this API, and silently accepting one would display a wrong
 * balance instead of degrading to `invalid-response`.
 */
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Parse one decimal money field, naming it in the error for diagnosability. */
function parseDecimal(value, field) {
    if (typeof value !== 'string' || !DECIMAL_STRING.test(value)) {
        throw new TypeError(`dsh-siliconflow-balance: ${field} is not a decimal string`);
    }
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        throw new TypeError(`dsh-siliconflow-balance: ${field} is not a finite amount`);
    }
    return amount;
}
/**
 * Parse the SiliconFlow `/v1/user/info` envelope into `BalanceAmounts`.
 *
 * The envelope is `{ code: 20000, message, status: true, data: { balance,
 * chargeBalance, totalBalance } }`; anything else is rejected so the Host can
 * report `invalid-response` instead of serving a half-trusted number.
 * See docs/design.md §3.
 */
export function parseUserInfo(body) {
    if (!isRecord(body)) {
        throw new TypeError('dsh-siliconflow-balance: user/info body is not an object');
    }
    if (body['code'] !== 20000) {
        throw new TypeError('dsh-siliconflow-balance: user/info envelope code is not 20000');
    }
    if (body['status'] === false) {
        throw new TypeError('dsh-siliconflow-balance: user/info envelope status is false');
    }
    const data = body['data'];
    if (!isRecord(data)) {
        throw new TypeError('dsh-siliconflow-balance: user/info data is not an object');
    }
    return {
        granted: parseDecimal(data['balance'], 'data.balance'),
        charged: parseDecimal(data['chargeBalance'], 'data.chargeBalance'),
        total: parseDecimal(data['totalBalance'], 'data.totalBalance'),
    };
}
/**
 * Format a CNY amount for the pill: two decimals and a `¥` prefix
 * (`88.88` → `¥88.88`). Intentionally locale-independent so the value reads
 * identically in every DSH locale and in the Host log.
 */
export function formatCny(amount) {
    if (!Number.isFinite(amount)) {
        throw new TypeError('dsh-siliconflow-balance: amount is not finite');
    }
    return `¥${amount.toFixed(2)}`;
}
/** Join a configured base URL with the vendor's balance endpoint. */
export function userInfoUrl(baseUrl) {
    return `${baseUrl.trim().replace(/\/+$/, '')}/user/info`;
}
//# sourceMappingURL=balance.js.map