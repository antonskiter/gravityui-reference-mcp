import { describe, it, expect } from 'vitest';
import { handleGetDesignTokens, formatGetDesignTokens } from './get-design-tokens.js';
import type { TokenSet } from '../../types.js';

const testTokens: TokenSet = {
  spacing: { '0': '0px', '0.5': '2px', '1': '4px', '2': '8px', '3': '12px', '10': '40px', '4': '16px', '5': '20px' },
  breakpoints: { xl: 1200, xs: 0, m: 768, s: 576, l: 1080 },
  sizes: { l: '36px', xs: '20px', xl: '44px', s: '24px', m: '28px' },
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

  it('sorts spacing numerically by key', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, { topic: 'spacing' });
    const output = formatGetDesignTokens(result);
    const spacingLines = output.split('\n').filter((l) => l.match(/^\s+\d/));
    const keys = spacingLines.map((l) => l.trim().split(':')[0]);
    expect(keys).toEqual(['0', '0.5', '1', '2', '3', '4', '5', '10']);
  });

  it('sorts breakpoints by pixel value', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, { topic: 'breakpoints' });
    const output = formatGetDesignTokens(result);
    const bpLines = output.split('\n').filter((l) => l.match(/^\s+\w+:\s+\d+px/));
    const keys = bpLines.map((l) => l.trim().split(':')[0]);
    expect(keys).toEqual(['xs', 's', 'm', 'l', 'xl']);
  });

  it('sorts sizes in t-shirt order', () => {
    const result = handleGetDesignTokens({ tokens: testTokens } as any, { topic: 'sizes' });
    const output = formatGetDesignTokens(result);
    const sizeLines = output.split('\n').filter((l) => l.match(/^\s+\w+:\s+\d+px/));
    const keys = sizeLines.map((l) => l.trim().split(':')[0]);
    expect(keys).toEqual(['xs', 's', 'm', 'l', 'xl']);
  });
});
