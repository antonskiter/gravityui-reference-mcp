import { describe, it, expect } from 'vitest';
import { codeBlock, indent } from '../text-utils.js';

describe('codeBlock', () => {
  it('wraps code with triple backtick fences and language tag', () => {
    const result = codeBlock('tsx', '<Button>Click</Button>');
    expect(result).toBe('```tsx\n<Button>Click</Button>\n```');
  });

  it('preserves multi-line code as-is', () => {
    const code = 'const a = 1;\nconst b = 2;';
    const result = codeBlock('ts', code);
    expect(result).toBe('```ts\nconst a = 1;\nconst b = 2;\n```');
  });

  it('works with an empty language string', () => {
    const result = codeBlock('', 'hello');
    expect(result).toBe('```\nhello\n```');
  });
});

describe('indent', () => {
  it('prepends the default three-space prefix to every non-empty line', () => {
    const result = indent('foo\nbar');
    expect(result).toBe('   foo\n   bar');
  });

  it('uses a custom prefix when provided', () => {
    const result = indent('foo\nbar', '  ');
    expect(result).toBe('  foo\n  bar');
  });

  it('leaves empty lines as empty strings (no prefix)', () => {
    const result = indent('foo\n\nbar');
    expect(result).toBe('   foo\n\n   bar');
  });

  it('handles a single line without trailing newline', () => {
    const result = indent('hello');
    expect(result).toBe('   hello');
  });
});
