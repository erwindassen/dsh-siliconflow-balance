import { describe, expect, it } from 'vitest';
import {
  CONSOLE_ORIGIN,
  consolePageUrl,
  formatCny,
  nanoToCny,
  parseWalletPeek,
  peekUrl,
} from '../src/balance.js';

/** The shape SiliconFlow's console wallet service answered on 2026-11-12. */
const OK_ENVELOPE = {
  code: 20000,
  data: {
    financialInfo: {
      balance: '906696398000',
      available: '906696398000',
      recharged: '5000000000000',
      used: '4093303602000',
      lineOfCredit: '0',
      remainingCreditLine: '0',
    },
  },
};

describe('parseWalletPeek', () => {
  it('reads nano-yuan integers as CNY amounts', () => {
    const reading = parseWalletPeek(OK_ENVELOPE);
    expect(reading.amounts).toEqual({
      available: 906.696398,
      recharged: 5000,
      used: 4093.303602,
    });
    expect(Number.isNaN(Date.parse(reading.asOf))).toBe(false);
  });

  it('keeps available + used equal to recharged for the sample account', () => {
    const { amounts } = parseWalletPeek(OK_ENVELOPE);
    expect(amounts.available + amounts.used).toBeCloseTo(amounts.recharged, 6);
  });

  it('rejects bodies that are not objects', () => {
    for (const body of [null, undefined, 'ok', 42, [], true]) {
      expect(() => parseWalletPeek(body)).toThrow();
    }
  });

  it('rejects an envelope whose code is not 20000', () => {
    expect(() => parseWalletPeek({ ...OK_ENVELOPE, code: 30014 })).toThrow(/code is 30014/);
    expect(() => parseWalletPeek({ data: OK_ENVELOPE.data })).toThrow(/expected 20000/);
  });

  it('rejects a response without financialInfo', () => {
    expect(() => parseWalletPeek({ code: 20000, data: {} })).toThrow(/financialInfo/);
    expect(() => parseWalletPeek({ code: 20000, data: null })).toThrow(/data is not an object/);
  });

  it('rejects missing or malformed amount fields', () => {
    const withInfo = (financialInfo: unknown) => ({ code: 20000, data: { financialInfo } });
    expect(() => parseWalletPeek(withInfo({}))).toThrow();
    expect(() => parseWalletPeek(withInfo({ available: 906, recharged: '1', used: '1' }))).toThrow();
    for (const bad of ['', 'abc', '1.5', '-1', '+1', '.5', '1e3', '1,000', '007']) {
      expect(() => parseWalletPeek(withInfo({ available: bad, recharged: '1', used: '1' }))).toThrow();
    }
  });

  it('treats zero amounts as valid', () => {
    const reading = parseWalletPeek({
      code: 20000,
      data: { financialInfo: { available: '0', recharged: '0', used: '0' } },
    });
    expect(reading.amounts).toEqual({ available: 0, recharged: 0, used: 0 });
  });
});

describe('nanoToCny', () => {
  it('converts one nano-yuan to 1e-9 CNY', () => {
    expect(nanoToCny('1')).toBe(1e-9);
  });

  it('converts a whole round amount', () => {
    expect(nanoToCny('5000000000000')).toBe(5000);
  });

  it('stays exact past the float-safe integer range', () => {
    // 9_007_199_254_740_993 nano-yuan is 9007199.254740993 CNY.
    expect(nanoToCny('9007199254740993')).toBe(9007199.254740993);
  });

  it('rejects anything that is not an unsigned integer string', () => {
    for (const bad of [undefined, null, 1, '1.0', '-1', '', ' 1']) {
      expect(() => nanoToCny(bad)).toThrow();
    }
  });
});

describe('formatCny', () => {
  it('always shows two decimals with the currency mark', () => {
    expect(formatCny(0)).toBe('¥0.00');
    expect(formatCny(1234.5)).toBe('¥1234.50');
    expect(formatCny(906.696398)).toBe('¥906.70');
    expect(formatCny(0.004)).toBe('¥0.00');
    expect(formatCny(0.006)).toBe('¥0.01');
  });

  it('rejects non-finite amounts', () => {
    expect(() => formatCny(Number.NaN)).toThrow();
    expect(() => formatCny(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('urls', () => {
  it('joins the wallet peek path onto the console origin', () => {
    expect(peekUrl(CONSOLE_ORIGIN)).toBe(
      'https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek',
    );
    expect(peekUrl('https://cloud.siliconflow.com/')).toBe(
      'https://cloud.siliconflow.com/walletd-server/api/v1/subject/profile/peek',
    );
    expect(peekUrl(' https://example.test/// ')).toBe(
      'https://example.test/walletd-server/api/v1/subject/profile/peek',
    );
  });

  it('joins the billing page onto the console origin', () => {
    expect(consolePageUrl(CONSOLE_ORIGIN)).toBe('https://cloud.siliconflow.com/me/expensebill');
  });

  it('rejects an empty origin', () => {
    expect(() => peekUrl('')).toThrow();
  });
});
