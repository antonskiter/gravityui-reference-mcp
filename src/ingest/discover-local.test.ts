import { describe, it, expect } from 'vitest';
import { discoverLocal } from './discover-local.js';

describe('discoverLocal', () => {
  it('discovers README.md files from vendor submodules', () => {
    const result = discoverLocal('vendor');
    expect(result.pages.length).toBeGreaterThan(50);
    const buttonPage = result.pages.find(
      p => p.name === 'Button' && p.library === 'uikit'
    );
    expect(buttonPage).toBeDefined();
    expect(buttonPage!.content).toContain('#');
  });

  it('discovers design guide pages from landing repo', () => {
    const result = discoverLocal('vendor');
    const guidePage = result.pages.find(p => p.page_type === 'guide');
    expect(guidePage).toBeDefined();
  });
});
