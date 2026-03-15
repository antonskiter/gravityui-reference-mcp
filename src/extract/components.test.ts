import { describe, it, expect } from 'vitest';
import { discoverComponents } from './components.js';

describe('discoverComponents', () => {
  it('finds components exported from uikit index', () => {
    const result = discoverComponents('vendor/uikit');
    // Button is a known export
    expect(result).toContainEqual(
      expect.objectContaining({ name: 'Button', sourceFile: expect.stringContaining('Button') })
    );
  });

  it('finds layout components (Flex, Box, Row, Col, Container)', () => {
    const result = discoverComponents('vendor/uikit');
    const names = result.map(c => c.name);
    expect(names).toContain('Flex');
    expect(names).toContain('Box');
    expect(names).toContain('Row');
    expect(names).toContain('Col');
    expect(names).toContain('Container');
  });

  it('does not include internal/private components', () => {
    const result = discoverComponents('vendor/uikit');
    const names = result.map(c => c.name);
    // Internal utilities should not appear
    expect(names).not.toContain('block');
    expect(names).not.toContain('getConfig');
  });
});
