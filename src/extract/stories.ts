import fs from 'fs';
import path from 'path';

/**
 * Extract code examples from a Storybook story file.
 * Looks for `render:` functions and `args:` objects.
 * Returns clean JSX snippets suitable for documentation.
 */
export function extractStoryExamples(storyFilePath: string): string[] {
  const absPath = path.resolve(storyFilePath);
  if (!fs.existsSync(absPath)) return [];

  const content = fs.readFileSync(absPath, 'utf-8');
  const examples: string[] = [];

  // Strategy 1: Extract render function bodies
  const renderBlocks = extractRenderBlocks(content);
  for (const block of renderBlocks) {
    const cleaned = cleanExample(block);
    if (cleaned && cleaned.includes('<')) {
      examples.push(cleaned);
    }
  }

  // Strategy 2: If no render blocks, try to find args-based default story
  if (examples.length === 0) {
    const argsExample = extractArgsExample(content);
    if (argsExample) examples.push(argsExample);
  }

  // Limit to 3 most useful examples
  return examples.slice(0, 3);
}

function extractRenderBlocks(content: string): string[] {
  const blocks: string[] = [];
  // Match: render: (args) => ( or render: () => ( or render: (args) => { return
  // Also handles render: (args, context) => ( etc.
  const renderRegex = /render:\s*\([^)]*\)\s*=>\s*(\(|\{\s*(?:const\s|let\s|return\s))/g;
  let match;

  while ((match = renderRegex.exec(content)) !== null) {
    const opener = match[1].trimStart()[0]; // '(' or '{'
    const startIndex = match.index + match[0].length - 1; // back to position of opener char
    const block = extractBalancedBlock(content, startIndex, opener);
    if (block) blocks.push(block);
  }

  return blocks;
}

function extractBalancedBlock(content: string, start: number, opener: string): string | null {
  const closer = opener === '(' ? ')' : '}';
  let depth = 0;
  let i = start;

  while (i < content.length) {
    const ch = content[i];
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) {
        // Return content inside the outer delimiters
        return content.slice(start + 1, i).trim();
      }
    }
    i++;
  }

  return null;
}

function extractArgsExample(content: string): string | null {
  const componentMatch = content.match(/component:\s*(\w+)/);
  if (!componentMatch) return null;
  const component = componentMatch[1];

  const argsMatch = content.match(/args:\s*\{([^}]+)\}/);
  if (!argsMatch) return null;

  const argsStr = argsMatch[1].trim();
  const props = argsStr
    .split(',')
    .map(line => line.trim())
    .filter(line => !line.includes('action(') && line.includes(':'))
    .map(line => {
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/,$/, '');
      return `${key}={${value}}`;
    })
    .join(' ');

  return `<${component} ${props} />`;
}

function cleanExample(code: string): string {
  // If it's a return statement body, extract what's after `return`
  const returnMatch = code.match(/^\s*return\s+([\s\S]+)$/);
  if (returnMatch) {
    code = returnMatch[1].trim();
    // Strip outer parens if present
    if (code.startsWith('(') && code.endsWith(')')) {
      code = code.slice(1, -1).trim();
    }
  }

  return code
    .replace(/<Showcase[^>]*>/g, '')
    .replace(/<\/Showcase>/g, '')
    .replace(/\{\.\.\.args\}/g, '')
    .trim();
}
