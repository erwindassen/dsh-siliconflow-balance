/** Origin of the SiliconFlow console that owns the wallet service. */
export const CONSOLE_ORIGIN = 'https://cloud.siliconflow.com';
/** Console page whose network traffic carries the wallet request. */
export const CONSOLE_PAGE_PATH = '/me/expensebill';
/** Wallet micro-service route. Paths are not public: found in the console traffic. */
export const WALLET_PEEK_PATH = '/walletd-server/api/v1/subject/profile/peek';
/** How long the Host waits for the console wallet service. */
export const UPSTREAM_TIMEOUT_MS = 10_000;
/**
 * Wallet amounts are integer strings scaled by 1e12 per US dollar: the sample
 * capture's `5000000000000` is a $5.00 top-up and `654984326000` is $0.65 left.
 */
export const UNITS_PER_USD = 1_000_000_000_000;
/** The console answers a successful wallet request with this code. */
export const OK_CODE = 20000;
const UINTEGER = /^(?:0|[1-9]\d*)$/;
function asRecord(value, what) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${what} is not an object`);
    }
    return value;
}
/**
 * Scale a wallet integer string to US dollars.
 *
 * The scaling runs on the decimal string rather than with `BigInt` division so
 * that amounts beyond `Number.MAX_SAFE_INTEGER` still round to the nearest
 * double exactly once, instead of losing precision twice.
 */
export function unitsToUsd(value) {
    if (typeof value !== 'string' || !UINTEGER.test(value)) {
        throw new Error(`amount is not an unsigned integer string: ${String(value)}`);
    }
    const digits = value.padStart(13, '0');
    const whole = digits.slice(0, -12).replace(/^0+(?=\d)/, '');
    const fraction = digits.slice(-12).replace(/0+$/, '');
    return Number(fraction === '' ? whole : `${whole}.${fraction}`);
}
/** Decode the console wallet response into US-dollar amounts. */
export function parseWalletPeek(body) {
    const envelope = asRecord(body, 'wallet response');
    if (envelope.code !== OK_CODE) {
        throw new Error(`wallet response code is ${String(envelope.code)}, expected ${OK_CODE}`);
    }
    const data = asRecord(envelope.data, 'wallet response data');
    const financialInfo = asRecord(data.financialInfo, 'wallet response financialInfo');
    const amounts = {
        available: unitsToUsd(financialInfo.available),
        recharged: unitsToUsd(financialInfo.recharged),
        used: unitsToUsd(financialInfo.used),
    };
    return { amounts, asOf: new Date().toISOString() };
}
/**
 * Format a US-dollar amount for the pill: `$88.88`.
 *
 * Sub-cent balances keep four decimals so a nearly empty wallet does not read
 * as `$0.00` while it can still pay for a call.
 */
export function formatUsd(amount) {
    if (!Number.isFinite(amount))
        throw new Error(`amount is not finite: ${String(amount)}`);
    const digits = amount !== 0 && Math.abs(amount) < 0.01 ? 4 : 2;
    return `$${amount.toFixed(digits)}`;
}
function originOf(baseUrl) {
    const origin = baseUrl.trim().replace(/\/+$/, '');
    if (origin === '')
        throw new Error('console base URL is empty');
    return origin;
}
/** Console origin plus the wallet route. */
export function peekUrl(baseUrl) {
    return `${originOf(baseUrl)}${WALLET_PEEK_PATH}`;
}
/** Console page the user pastes the session from. */
export function consolePageUrl(baseUrl) {
    return `${originOf(baseUrl)}${CONSOLE_PAGE_PATH}`;
}
//# sourceMappingURL=balance.js.map