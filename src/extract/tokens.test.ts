import { describe, it, expect } from 'vitest';
import { extractTokens } from './tokens.js';

describe('extractTokens', () => {
  it('extracts spacing scale from layout constants', () => {
    const tokens = extractTokens('vendor/uikit');
    expect(tokens.spacing).toBeDefined();
    expect(Object.keys(tokens.spacing).length).toBeGreaterThan(5);
    expect(tokens.spacing['1']).toBeDefined();
  });

  it('extracts breakpoints', () => {
    const tokens = extractTokens('vendor/uikit');
    expect(tokens.breakpoints).toEqual({
      xs: 0, s: 576, m: 768, l: 1080, xl: 1200, xxl: 1400, xxxl: 1920,
    });
  });

  it('extracts component size heights', () => {
    const tokens = extractTokens('vendor/uikit');
    expect(tokens.sizes).toBeDefined();
    expect(tokens.sizes['m']).toBe('28px');
  });
});
