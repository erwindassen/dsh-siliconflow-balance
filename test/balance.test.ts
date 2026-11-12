import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, formatCny, parseUserInfo, userInfoUrl } from '../src/balance.js';

const okBody = {
  code: 20000,
  message: 'OK',
  status: true,
  data: {
    balance: '0.88',
    chargeBalance: '88.00',
    totalBalance: '88.88',
  },
};

describe('parseUserInfo', () => {
  it('parses the documented envelope into CNY amounts', () => {
    expect(parseUserInfo(okBody)).toEqual({ granted: 0.88, charged: 88, total: 88.88 });
  });

  it('accepts zero and large integer amounts', () => {
    expect(
      parseUserInfo({
        code: 20000,
        status: true,
        data: { balance: '0', chargeBalance: '12345', totalBalance: '12345' },
      }),
    ).toEqual({ granted: 0, charged: 12345, total: 12345 });
  });

  it('rejects a non-object body', () => {
    expect(() => parseUserInfo(null)).toThrow(/not an object/);
    expect(() => parseUserInfo('{}')).toThrow(/not an object/);
    expect(() => parseUserInfo([])).toThrow(/not an object/);
  });

  it('rejects an envelope that is not code 20000', () => {
    expect(() => parseUserInfo({ ...okBody, code: 30014 })).toThrow(/code is not 20000/);
  });

  it('rejects status: false', () => {
    expect(() => parseUserInfo({ ...okBody, status: false })).toThrow(/status is false/);
  });

  it('rejects missing or malformed data', () => {
    expect(() => parseUserInfo({ code: 20000, status: true })).toThrow(/data is not an object/);
    expect(() => parseUserInfo({ ...okBody, data: null })).toThrow(/data is not an object/);
  });

  it('rejects non-decimal-string amounts', () => {
    for (const bad of ['', 'abc', '1,000', '+1', '.5', '1e3', '-1', 88.88]) {
      expect(() =>
        parseUserInfo({ ...okBody, data: { ...okBody.data, totalBalance: bad } }),
      ).toThrow(/data\.totalBalance is not a decimal string/);
    }
  });

  it('names the offending field', () => {
    expect(() => parseUserInfo({ ...okBody, data: { ...okBody.data, chargeBalance: 'x' } })).toThrow(
      /data\.chargeBalance/,
    );
  });
});

describe('formatCny', () => {
  it('formats two decimals with a ¥ prefix', () => {
    expect(formatCny(88.88)).toBe('¥88.88');
    expect(formatCny(0)).toBe('¥0.00');
    expect(formatCny(1234.5)).toBe('¥1234.50');
    expect(formatCny(8.4)).toBe('¥8.40');
  });

  it('rounds to two decimals', () => {
    expect(formatCny(0.004)).toBe('¥0.00');
    expect(formatCny(0.006)).toBe('¥0.01');
  });

  it('rejects non-finite amounts', () => {
    expect(() => formatCny(Number.NaN)).toThrow(/not finite/);
    expect(() => formatCny(Number.POSITIVE_INFINITY)).toThrow(/not finite/);
  });
});

describe('userInfoUrl', () => {
  it('joins the default base URL', () => {
    expect(userInfoUrl(DEFAULT_BASE_URL)).toBe('https://api.siliconflow.com/v1/user/info');
  });

  it('tolerates trailing slashes and whitespace', () => {
    expect(userInfoUrl(' https://api.siliconflow.cn/v1/// ')).toBe(
      'https://api.siliconflow.cn/v1/user/info',
    );
  });
});
