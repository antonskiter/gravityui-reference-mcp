import fs from 'fs';
import path from 'path';
import type { TokenSet } from '../types.js';

/**
 * Extract design tokens from uikit source files.
 * Sources:
 *   - Breakpoints + spaceBaseSize from layout/constants.ts
 *   - Component heights from variables.scss
 *   - Spacing scale derived from spaceBaseSize
 */
export function extractTokens(vendorDir: string): TokenSet {
  const absDir = path.resolve(vendorDir);

  const breakpoints = extractBreakpoints(absDir);
  const spaceBase = extractSpaceBaseSize(absDir);
  const spacing = buildSpacingScale(spaceBase);
  const sizes = extractComponentSizes(absDir);

  return { spacing, breakpoints, sizes };
}

function extractBreakpoints(dir: string): Record<string, number> {
  const constantsPath = path.join(dir, 'src/components/layout/constants.ts');
  if (!fs.existsSync(constantsPath)) return {};

  const content = fs.readFileSync(constantsPath, 'utf-8');
  const match = content.match(/breakpoints:\s*\{([^}]+)\}/);
  if (!match) return {};

  const result: Record<string, number> = {};
  const entries = match[1].matchAll(/(\w+):\s*(\d+)/g);
  for (const [, key, value] of entries) {
    result[key] = parseInt(value, 10);
  }
  return result;
}

function extractSpaceBaseSize(dir: string): number {
  const constantsPath = path.join(dir, 'src/components/layout/constants.ts');
  if (!fs.existsSync(constantsPath)) return 4;

  const content = fs.readFileSync(constantsPath, 'utf-8');
  const match = content.match(/spaceBaseSize:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 4;
}

function buildSpacingScale(base: number): Record<string, string> {
  const multipliers = [0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result: Record<string, string> = {};
  for (const m of multipliers) {
    const key = m === 0.5 ? '0.5' : String(m);
    result[key] = `${m * base}px`;
  }
  return result;
}

function extractComponentSizes(dir: string): Record<string, string> {
  const varsPath = path.join(dir, 'src/components/variables.scss');
  if (!fs.existsSync(varsPath)) return {};

  const content = fs.readFileSync(varsPath, 'utf-8');
  const result: Record<string, string> = {};
  const sizeRegex = /\$(xs|s|m|l|xl)-height:\s*(\d+px)/g;
  let match;
  while ((match = sizeRegex.exec(content)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}
