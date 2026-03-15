import { describe, it, expect } from 'vitest';
import { extractStoryExamples } from './stories.js';

describe('extractStoryExamples', () => {
  it('extracts at least one example from Button stories', () => {
    const examples = extractStoryExamples(
      'vendor/uikit/src/components/Button/__stories__/Button.stories.tsx',
    );
    expect(examples.length).toBeGreaterThan(0);
  });

  it('extracts render functions as code snippets', () => {
    const examples = extractStoryExamples(
      'vendor/uikit/src/components/Select/__stories__/Select.stories.tsx',
    );
    const hasJsx = examples.some(e => e.includes('<Select'));
    expect(hasJsx).toBe(true);
  });

  it('returns empty array for missing story file', () => {
    const examples = extractStoryExamples('vendor/uikit/src/components/Nonexistent/__stories__/Nonexistent.stories.tsx');
    expect(examples).toEqual([]);
  });
});
