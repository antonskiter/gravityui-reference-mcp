import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLibraryConfig } from './library-config.js';
import type { ComponentDef, PropDef } from '../types.js';

export interface ComponentInfo {
  name: string;
  propsInterfaceName: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// extractComponentInfo
// ---------------------------------------------------------------------------

/**
 * Detect a React component export and its props interface name from TS source.
 * Returns null when the file does not contain a recognisable component export.
 */
export function extractComponentInfo(source: string): ComponentInfo | null {
  // Patterns ordered from most specific to least specific.
  // Each captures: (name, propsInterface)
  const patterns: RegExp[] = [
    // export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.forwardRef\s*<[^,>]+,\s*([A-Za-z][A-Za-z0-9_]*)\s*>/,
    // export const Flex = React.forwardRef(function Flex<T...>(props: FlexProps
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.forwardRef\s*\(\s*function\s+[A-Z][A-Za-z0-9_]*\s*(?:<[^(]*)?\(\s*[\n\r\s]*(?:\{[^}]*\}|[a-z_$][A-Za-z0-9_$]*)\s*:\s*([A-Za-z][A-Za-z0-9_]*)/,
    // export const Alert: React.FC<AlertProps>
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*:\s*React\.(?:FC|FunctionComponent|VFC|ComponentType|ComponentClass)\s*<\s*([A-Za-z][A-Za-z0-9_]*)\s*>/,
    // export function GraphCanvas({...}: GraphProps)
    /export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\([^)]*:\s*([A-Za-z][A-Za-z0-9_]*)\s*[),]/,
    // export const Foo = ({...}: FooProps) =>
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\([^)]*:\s*([A-Za-z][A-Za-z0-9_]*)\s*\)\s*=>/,
  ];

  for (const pattern of patterns) {
    const m = source.match(pattern);
    if (m) {
      const name = m[1];
      const propsInterfaceName = m[2];
      const description = extractJsDocBefore(source, m[0]);
      return { name, propsInterfaceName, description };
    }
  }

  return null;
}

/**
 * Find a JSDoc comment that appears immediately before the given code snippet.
 */
function extractJsDocBefore(source: string, snippet: string): string | undefined {
  const idx = source.indexOf(snippet);
  if (idx === -1) return undefined;

  const before = source.slice(0, idx);
  // Match the last /** ... */ block in the preceding text
  const jsDocPattern = /\/\*\*\s*([\s\S]*?)\s*\*\//g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = jsDocPattern.exec(before)) !== null) {
    last = m;
  }
  if (!last) return undefined;

  // Only use it if it's "close" (no blank lines separating it from snippet)
  const between = before.slice(last.index + last[0].length);
  if (/\n\s*\n/.test(between)) return undefined;

  // Clean up: strip leading * from each line, collapse whitespace
  const raw = last[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ');

  return raw || undefined;
}

// ---------------------------------------------------------------------------
// extractPropsFromSource
// ---------------------------------------------------------------------------

/**
 * Extract prop definitions from a named TypeScript interface inside source.
 */
export function extractPropsFromSource(source: string, propsInterfaceName: string): PropDef[] {
  const body = extractInterfaceBody(source, propsInterfaceName);
  if (body === null) return [];

  const defaults = extractDefaultValues(source, propsInterfaceName);
  return parseInterfaceBody(body, defaults);
}

/**
 * Extract the body (content between the braces) of a named interface.
 */
function extractInterfaceBody(source: string, name: string): string | null {
  // Match: interface Name { ... }  (with possible extends clause)
  // Use a simple brace-depth counter to find the matching close brace.
  const headerPattern = new RegExp(
    `(?:export\\s+)?interface\\s+${name}(?:<[^>]*>)?(?:\\s+extends[^{]+)?\\s*\\{`,
  );
  const headerMatch = source.match(headerPattern);
  if (!headerMatch || headerMatch.index === undefined) return null;

  const start = headerMatch.index + headerMatch[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return source.slice(start, i - 1);
}

/**
 * Scan destructured function parameters to collect default values.
 * e.g. ({gap = 0, direction = 'row'}: FlexProps)  →  { gap: '0', direction: "'row'" }
 */
function extractDefaultValues(source: string, propsInterfaceName: string): Record<string, string> {
  const defaults: Record<string, string> = {};

  // Find all function/arrow destructured params typed as propsInterfaceName
  // Pattern: ({...}: PropsName)  or  ({...}: PropsName,
  const destructPattern = new RegExp(
    `\\(\\s*\\{([^}]*)\\}\\s*:\\s*${propsInterfaceName}(?:<[^>]*>)?`,
    'g',
  );
  let dm: RegExpExecArray | null;
  while ((dm = destructPattern.exec(source)) !== null) {
    const paramList = dm[1];
    // Each item: propName = defaultValue (may have trailing comma/whitespace)
    const itemPattern = /([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^,}\s][^,}]*?)(?:\s*[,}]|$)/g;
    let im: RegExpExecArray | null;
    while ((im = itemPattern.exec(paramList)) !== null) {
      defaults[im[1]] = im[2].trim();
    }
  }

  return defaults;
}

/**
 * Parse the body of an interface into PropDef objects.
 */
function parseInterfaceBody(body: string, defaults: Record<string, string>): PropDef[] {
  const props: PropDef[] = [];

  // Split by lines, accumulate JSDoc comments
  const lines = body.split('\n');
  let pendingJsDoc: string | undefined;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Single-line JSDoc: /** ... */
    const inlineDoc = line.match(/^\/\*\*\s*(.*?)\s*\*\/\s*$/);
    if (inlineDoc) {
      pendingJsDoc = inlineDoc[1].trim() || undefined;
      i++;
      continue;
    }

    // Multi-line JSDoc start
    if (line.startsWith('/**')) {
      const docLines: string[] = [];
      // Grab opening line content after /**
      const firstContent = line.replace(/^\/\*\*\s*/, '').replace(/\*\/$/, '').trim();
      if (firstContent) docLines.push(firstContent);
      i++;
      while (i < lines.length) {
        const dl = lines[i].trim();
        if (dl.endsWith('*/')) {
          const content = dl.replace(/\*\/$/, '').replace(/^\*\s?/, '').trim();
          if (content) docLines.push(content);
          i++;
          break;
        }
        const content = dl.replace(/^\*\s?/, '').trim();
        if (content) docLines.push(content);
        i++;
      }
      pendingJsDoc = docLines.join(' ') || undefined;
      continue;
    }

    // Single-line comment — skip
    if (line.startsWith('//')) {
      i++;
      continue;
    }

    // Try to match a prop declaration
    // Handles: propName?: type;   propName: type;
    // Type may span multiple tokens — grab everything after the colon up to ;
    const propMatch = line.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\??):\s*(.*?)\s*;?\s*$/);
    if (propMatch) {
      const name = propMatch[1];
      const optional = propMatch[2] === '?';
      let typeStr = propMatch[3].replace(/;$/, '').trim();

      // If line doesn't end with ; and type looks incomplete, gather more lines
      if (!line.endsWith(';') && !line.endsWith(',') && typeStr) {
        // Check if the type string itself is complete (no dangling |)
        // Simple heuristic: keep reading if last non-space char is |
        while (typeStr.trimEnd().endsWith('|') && i + 1 < lines.length) {
          i++;
          const next = lines[i].trim().replace(/;$/, '').trim();
          typeStr += ' ' + next;
        }
      }

      // Remove trailing semicolon
      typeStr = typeStr.replace(/;$/, '').trim();

      const prop: PropDef = {
        name,
        type: typeStr,
        required: !optional,
      };

      if (pendingJsDoc) {
        prop.description = pendingJsDoc;
      }

      const def = defaults[name];
      if (def !== undefined) {
        prop.default = def;
      }

      // Detect @deprecated tag
      if (pendingJsDoc && /@deprecated/i.test(pendingJsDoc)) {
        prop.deprecated = true;
      }

      props.push(prop);
      pendingJsDoc = undefined;
    } else {
      // Not a prop line — clear pending jsdoc only if line is non-empty
      if (line.length > 0) {
        pendingJsDoc = undefined;
      }
    }

    i++;
  }

  return props;
}

// ---------------------------------------------------------------------------
// extractLibraryComponents
// ---------------------------------------------------------------------------

/**
 * Orchestrates component discovery for an entire library using vendor source.
 */
export function extractLibraryComponents(vendorDir: string, libraryName: string): ComponentDef[] {
  const config = getLibraryConfig(libraryName);

  if (config.moduleBased) {
    // Module-based libraries (e.g. markdown-editor) are not handled by source extraction.
    return [];
  }

  const components: Map<string, ComponentDef> = new Map();

  for (const componentPath of config.componentPaths) {
    const absPath = path.join(vendorDir, libraryName, componentPath);

    if (!fs.existsSync(absPath)) continue;

    if (config.flatFiles) {
      // Flat: .tsx files starting with uppercase directly in the directory
      const entries = fs.readdirSync(absPath);
      for (const entry of entries) {
        if (!/^[A-Z].*\.tsx$/.test(entry)) continue;
        const filePath = path.join(absPath, entry);
        const componentName = entry.replace(/\.tsx$/, '');
        processFile(filePath, componentName, libraryName, config.packageName, vendorDir, components);
      }
    } else {
      // Directory-based: subdirs starting with uppercase contain a .tsx file
      const entries = fs.readdirSync(absPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!/^[A-Z]/.test(entry.name)) continue;

        const componentDir = path.join(absPath, entry.name);
        // Try ComponentName.tsx first, then index.tsx
        const candidates = [
          path.join(componentDir, `${entry.name}.tsx`),
          path.join(componentDir, 'index.tsx'),
        ];

        let filePath: string | null = null;
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            break;
          }
        }

        if (!filePath) continue;

        let description: string | undefined;
        const readmePath = path.join(componentDir, 'README.md');
        if (fs.existsSync(readmePath)) {
          description = extractReadmeDescription(readmePath);
        }

        processFile(
          filePath,
          entry.name,
          libraryName,
          config.packageName,
          vendorDir,
          components,
          description,
        );
      }
    }
  }

  return Array.from(components.values());
}

function processFile(
  filePath: string,
  expectedName: string,
  libraryName: string,
  packageName: string,
  vendorDir: string,
  components: Map<string, ComponentDef>,
  readmeDescription?: string,
): void {
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  const info = extractComponentInfo(source);
  if (!info) return;

  // Use detected name if it matches expected (case-insensitive), else fall back to expected
  const name = info.name ?? expectedName;

  const props = extractPropsFromSource(source, info.propsInterfaceName);

  const relativeFile = path.relative(vendorDir, filePath);
  const description = readmeDescription ?? info.description;

  const def: ComponentDef = {
    name,
    library: libraryName,
    import_path: packageName,
    import_statement: `import {${name}} from '${packageName}';`,
    props,
    examples: [],
    source_file: relativeFile,
    ...(description ? { description } : {}),
  };

  // Deduplicate: keep the one with more props
  const existing = components.get(name);
  if (!existing || props.length > existing.props.length) {
    components.set(name, def);
  }
}

function extractReadmeDescription(readmePath: string): string | undefined {
  let content: string;
  try {
    content = fs.readFileSync(readmePath, 'utf8');
  } catch {
    return undefined;
  }

  // Find the first non-empty, non-heading paragraph
  const lines = content.split('\n');
  const paragraphLines: string[] = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings
    if (trimmed.startsWith('#')) continue;
    // Skip empty lines while not in paragraph
    if (!trimmed && !inParagraph) continue;
    // Empty line ends the paragraph
    if (!trimmed && inParagraph) break;

    paragraphLines.push(trimmed);
    inParagraph = true;
  }

  const text = paragraphLines.join(' ').trim();
  return text || undefined;
}
