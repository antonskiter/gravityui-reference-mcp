import type { LoadedData } from '../loader.js';
import type { TokenSet } from '../../types.js';

export interface GetDesignTokensInput {
  topic?: 'spacing' | 'breakpoints' | 'sizes' | 'colors';
}

export type GetDesignTokensOutput = Partial<TokenSet>;

export function handleGetDesignTokens(
  data: LoadedData,
  input: GetDesignTokensInput,
): GetDesignTokensOutput {
  const { topic } = input;
  const tokens = data.tokens;

  if (!topic) return tokens;
  return { [topic]: tokens[topic] } as GetDesignTokensOutput;
}

export function formatGetDesignTokens(output: GetDesignTokensOutput): string {
  const lines: string[] = [];

  if (output.spacing) {
    lines.push('Spacing (base unit: 4px)');
    lines.push('');
    for (const [key, value] of Object.entries(output.spacing)) {
      lines.push(`  ${key}: ${value}`);
    }
    lines.push('');
    lines.push('Usage: <Flex gap={3}> means gap of 12px');
  }

  if (output.breakpoints) {
    if (lines.length) lines.push('');
    lines.push('Breakpoints');
    lines.push('');
    for (const [key, value] of Object.entries(output.breakpoints)) {
      lines.push(`  ${key}: ${value}px`);
    }
    lines.push('');
    lines.push('Usage: <Col size={{s: 12, m: 6, l: 4}}> — full width on small, half on medium, third on large');
  }

  if (output.sizes) {
    if (lines.length) lines.push('');
    lines.push('Component sizes (height)');
    lines.push('');
    for (const [key, value] of Object.entries(output.sizes)) {
      lines.push(`  ${key}: ${value}`);
    }
    lines.push('');
    lines.push('Usage: <Button size="m"> renders at 28px height');
  }

  if (output.colors) {
    if (lines.length) lines.push('');
    lines.push('Semantic colors');
    lines.push('');
    for (const [key, value] of Object.entries(output.colors)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}
