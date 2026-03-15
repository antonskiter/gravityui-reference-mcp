import { describe, it, expect } from 'vitest';
import { generateLlmsTxt, generateLlmsFullTxt } from './llms-txt.js';
import type { ComponentDef, TokenSet } from '../types.js';

const testComponents: ComponentDef[] = [
  {
    name: 'Button', library: 'uikit', import_path: '@gravity-ui/uikit',
    import_statement: "import {Button} from '@gravity-ui/uikit';",
    props: [{ name: 'size', type: "'s' | 'm' | 'l'", required: false }],
    examples: ['<Button size="m">Click</Button>'],
    description: 'Clickable action element',
    source_file: 'src/components/Button/Button.tsx',
  },
];
const testTokens: TokenSet = {
  spacing: { '1': '4px', '2': '8px' },
  breakpoints: { s: 576, m: 768 },
  sizes: { m: '28px' },
};

describe('generateLlmsTxt', () => {
  it('starts with H1 and blockquote', () => {
    const result = generateLlmsTxt(testComponents, testTokens);
    expect(result).toMatch(/^# Gravity UI/);
    expect(result).toContain('> ');
  });

  it('lists components with descriptions', () => {
    const result = generateLlmsTxt(testComponents, testTokens);
    expect(result).toContain('Button');
    expect(result).toContain('Clickable action element');
  });

  it('is under 10K tokens (~40K chars)', () => {
    const result = generateLlmsTxt(testComponents, testTokens);
    expect(result.length).toBeLessThan(40000);
  });
});

describe('generateLlmsFullTxt', () => {
  it('includes TypeScript interfaces', () => {
    const result = generateLlmsFullTxt(testComponents, testTokens);
    expect(result).toContain("size?:");
    expect(result).toContain("'s' | 'm' | 'l'");
  });

  it('includes code examples', () => {
    const result = generateLlmsFullTxt(testComponents, testTokens);
    expect(result).toContain('<Button');
  });
});
