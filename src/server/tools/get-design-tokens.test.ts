import { describe, it, expect } from 'vitest';
import { handleGetDesignTokens, formatGetDesignTokens } from './get-design-tokens.js';
import type { TokenSet } from '../../types.js';

const testTokens: TokenSet = {
  spacing: { '0': '0px', '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '20px' },
  breakpoints: { xs: 0, s: 576, m: 768, l: 1080, xl: 1200 },
  sizes: { xs: '20px', s: '24px', m: '28px', l: '36px', xl: '44px' },
};

describe('handleGetDesignTokens', () => {
  it('returns all tokens when no topic specified', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, {});
    expect(result.spacing).toBeDefined();
    expect(result.breakpoints).toBeDefined();
    expect(result.sizes).toBeDefined();
  });

  it('returns only spacing when topic is spacing', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, { topic: 'spacing' });
    expect(result.spacing).toBeDefined();
    expect(result.breakpoints).toBeUndefined();
  });
});

describe('formatGetDesignTokens', () => {
  it('formats spacing as readable list', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, { topic: 'spacing' });
    const output = formatGetDesignTokens(result);
    expect(output).toContain('Spacing');
    expect(output).toContain('4px');
  });
});
