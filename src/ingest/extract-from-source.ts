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
// Helper: find the balanced closing paren/brace/bracket from a given position
// ---------------------------------------------------------------------------

/**
 * Starting at `pos` (which should point at '(' or '{' or '<'), find the
 * matching close character.  Returns the index of the matching close char,
 * or -1 if not found.  Skips nested pairs of the same type plus strings.
 */
function findBalancedClose(source: string, pos: number): number {
  const open = source[pos];
  const closeMap: Record<string, string> = { '(': ')', '{': '}', '<': '>', '[': ']' };
  const close = closeMap[open];
  if (!close) return -1;

  let depth = 1;
  let i = pos + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === open) { depth++; }
    else if (ch === close) { depth--; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      // skip string
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i++; // skip escaped
        i++;
      }
    }
    i++;
  }
  return depth === 0 ? i - 1 : -1;
}

/**
 * Extract the balanced content between the open and close characters at the
 * given position.  Returns the inner text (excluding the delimiters), or null.
 */
function extractBalancedContent(source: string, openPos: number): string | null {
  const closePos = findBalancedClose(source, openPos);
  if (closePos === -1) return null;
  return source.slice(openPos + 1, closePos);
}

/**
 * For a function-style component (export function / export const =), find
 * the props type annotation inside the parameter list.  Handles multi-line
 * params with nested parentheses (default values like `i18n(...)`, arrow
 * functions, etc.).
 *
 * `paramStartIdx` should point at the opening `(` of the parameter list.
 */
function extractPropsTypeFromParams(source: string, paramStartIdx: number): string | null {
  const inner = extractBalancedContent(source, paramStartIdx);
  if (inner === null) return null;

  // Look for }: PropsType  or ,  paramName: PropsType  patterns
  // The props interface name follows }: or the last : in the params
  const typeMatch = inner.match(/\}\s*:\s*(?:React\.PropsWithChildren\s*<\s*)?([A-Z][A-Za-z0-9_]*)/);
  if (typeMatch) return typeMatch[1];

  // Simple single-param: (props: PropsType
  const simpleMatch = inner.match(/^\s*[a-z_$][A-Za-z0-9_$]*\s*:\s*([A-Z][A-Za-z0-9_]*)/);
  if (simpleMatch) return simpleMatch[1];

  return null;
}

// ---------------------------------------------------------------------------
// extractComponentInfo
// ---------------------------------------------------------------------------

/**
 * Detect a React component export and its props interface name from TS source.
 * Returns null when the file does not contain a recognisable component export.
 */
export function extractComponentInfo(source: string): ComponentInfo | null {
  let result: ComponentInfo | null = null;

  // --- Phase 1: Simple regex patterns (most specific first) ---

  const patterns: RegExp[] = [
    // Pattern 1: export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.forwardRef\s*<[^,>]+,\s*([A-Za-z][A-Za-z0-9_]*)\s*>/,

    // Pattern G1: export const Icon: React.ForwardRefExoticComponent<IconProps & ...> = React.forwardRef<..., IconProps>(
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*:[^=]+=\s*React\.forwardRef\s*<[^,>]+,\s*([A-Za-z][A-Za-z0-9_]*)\s*>/,

    // Pattern 3: export const Alert: React.FC<AlertProps>
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*:\s*(?:React\.)?(?:FC|FunctionComponent|VFC|ComponentType|ComponentClass)\s*<\s*([A-Za-z][A-Za-z0-9_]*)\s*>/,

    // Pattern B: export const X = React.memo(function X(props: Props) {...})
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.memo\s*\(\s*function\s+[A-Z][A-Za-z0-9_]*\s*\(\s*(?:[\n\r\s]*(?:\{[^}]*\}|[a-z_$][A-Za-z0-9_$]*))\s*:\s*([A-Za-z][A-Za-z0-9_]*)/,
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

  // --- Phase 2: forwardRef(function Name<T>(params)) — balanced paren matching ---
  // Handles: export const X = React.forwardRef(function X<T...>({...}: Props, ref))
  const fwdRefFnPattern = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.forwardRef\s*\(\s*function\s+[A-Z][A-Za-z0-9_]*\s*(?:<[^(]*)?\(/g;
  let fwdRefFnMatch: RegExpExecArray | null;
  while ((fwdRefFnMatch = fwdRefFnPattern.exec(source)) !== null) {
    // Find the opening paren of the function params
    const parenIdx = source.lastIndexOf('(', fwdRefFnPattern.lastIndex - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) {
      const name = fwdRefFnMatch[1];
      const description = extractJsDocBefore(source, fwdRefFnMatch[0]);
      return { name, propsInterfaceName: propsType, description };
    }
  }

  // --- Phase 3: forwardRef with inline destructured params (multi-line) ---
  // Handles: export const BaseTable = React.forwardRef( <T,...>({...}: Props, ref) => {
  const fwdRefArrowPattern = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=]+=|=)\s*React\.forwardRef\s*\(\s*(?:<[^(]*)?\(/g;
  let fwdRefArrowMatch: RegExpExecArray | null;
  while ((fwdRefArrowMatch = fwdRefArrowPattern.exec(source)) !== null) {
    const parenIdx = source.lastIndexOf('(', fwdRefArrowPattern.lastIndex - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) {
      const name = fwdRefArrowMatch[1];
      const description = extractJsDocBefore(source, fwdRefArrowMatch[0]);
      return { name, propsInterfaceName: propsType, description };
    }
  }

  // --- Phase 4: export function X<T>({...}: Props) — balanced paren matching ---
  // Handles generic functions where [^)]* would fail on default values containing )
  const exportFnPattern = /export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*(?:<[^(]*)?\(/g;
  let exportFnMatch: RegExpExecArray | null;
  while ((exportFnMatch = exportFnPattern.exec(source)) !== null) {
    const parenIdx = source.lastIndexOf('(', exportFnPattern.lastIndex - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) {
      const name = exportFnMatch[1];
      const description = extractJsDocBefore(source, exportFnMatch[0]);
      return { name, propsInterfaceName: propsType, description };
    }
  }

  // --- Phase 5: export const X = ({...}: Props) => ... — balanced paren matching ---
  const exportConstArrowPattern = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(/g;
  let exportConstArrowMatch: RegExpExecArray | null;
  while ((exportConstArrowMatch = exportConstArrowPattern.exec(source)) !== null) {
    const parenIdx = exportConstArrowPattern.lastIndex - 1;
    const closeIdx = findBalancedClose(source, parenIdx);
    if (closeIdx === -1) continue;
    // Check that => follows the close paren
    const afterParen = source.slice(closeIdx + 1, closeIdx + 20).trimStart();
    if (!afterParen.startsWith('=>')) continue;
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) {
      const name = exportConstArrowMatch[1];
      const description = extractJsDocBefore(source, exportConstArrowMatch[0]);
      return { name, propsInterfaceName: propsType, description };
    }
  }

  // --- Phase 6: Pattern C — forwardRef with function reference ---
  // export const X = React.forwardRef(SomeFunctionName)
  // Then look up function SomeFunctionName(props: PropsType, ref: ...)
  const fwdRefRefPattern = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*React\.forwardRef\s*\(\s*([A-Z][A-Za-z0-9_]*)\s*\)/;
  const fwdRefRefMatch = source.match(fwdRefRefPattern);
  if (fwdRefRefMatch) {
    const name = fwdRefRefMatch[1];
    const fnName = fwdRefRefMatch[2];
    // Find the function definition
    const fnDefPattern = new RegExp(`function\\s+${fnName}\\s*(?:<[^(]*)?(\\()`);
    const fnDefMatch = source.match(fnDefPattern);
    if (fnDefMatch && fnDefMatch.index !== undefined) {
      const parenIdx = source.indexOf('(', fnDefMatch.index + fnDefMatch[0].length - 1);
      const propsType = extractPropsTypeFromParams(source, parenIdx);
      if (propsType) {
        const description = extractJsDocBefore(source, fwdRefRefMatch[0]);
        return { name, propsInterfaceName: propsType, description };
      }
    }
  }

  // --- Phase 6b: Pattern F — export class X extends React.Component<Props> ---
  // Uses balanced angle-bracket matching for generics like <T extends Foo = Record<string, string>>
  const classPattern = /export\s+(?:default\s+)?class\s+([A-Z][A-Za-z0-9_]*)\s*(?:<|(?=\s+extends))/g;
  let classMatch: RegExpExecArray | null;
  while ((classMatch = classPattern.exec(source)) !== null) {
    const className = classMatch[1];
    // Skip the generic params if present
    let searchFrom = classPattern.lastIndex;
    if (source[searchFrom - 1] === '<') {
      const closeAngle = findBalancedClose(source, searchFrom - 1);
      if (closeAngle === -1) continue;
      searchFrom = closeAngle + 1;
    }
    // Now match: extends React.Component<PropsType
    const afterGenerics = source.slice(searchFrom);
    const extendsMatch = afterGenerics.match(/^\s+extends\s+React\.Component\s*<\s*([A-Za-z][A-Za-z0-9_]*)/);
    if (extendsMatch) {
      const propsInterfaceName = extendsMatch[1];
      const description = extractJsDocBefore(source, classMatch[0]);
      return { name: className, propsInterfaceName, description };
    }
  }

  // --- Phase 7: Pattern A — Object.assign with internal component ---
  // export const X = Object.assign(_X, {...}) or
  // const XExport = Object.assign(X, {...}); export {XExport as X}
  result = extractObjectAssignComponent(source);
  if (result) return result;

  // --- Phase 8: Pattern E — export default X ---
  // First find: export default X  (identifier, not inline expression)
  // Then look up the component definition of X above
  result = extractDefaultExportComponent(source);
  if (result) return result;

  return null;
}

/**
 * Handle Object.assign pattern: find the internal component and extract its props.
 *
 * Patterns handled:
 *   export const Button = Object.assign(_Button, {Icon: ButtonIcon})
 *   const PublicX = Object.assign(X, {...}); export {PublicX as X}
 */
function extractObjectAssignComponent(source: string): ComponentInfo | null {
  // Pattern: export const X = Object.assign(_Y, {
  const directAssign = /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*Object\.assign\s*\(\s*_?([A-Za-z][A-Za-z0-9_]*)/;
  const directMatch = source.match(directAssign);
  if (directMatch) {
    const name = directMatch[1];
    const internalName = directMatch[2];
    const info = findInternalComponentInfo(source, internalName);
    if (info) {
      return { name, propsInterfaceName: info, description: extractJsDocBefore(source, directMatch[0]) };
    }
  }

  // Pattern: const XExport = Object.assign(X, {...}); ... export {XExport as X}
  const namedAssign = /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*Object\.assign\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*,/g;
  let namedMatch: RegExpExecArray | null;
  while ((namedMatch = namedAssign.exec(source)) !== null) {
    const aliasName = namedMatch[1];
    const internalName = namedMatch[2];
    // Check for: export {aliasName as ExportName}
    const reExportPattern = new RegExp(`export\\s*\\{\\s*${aliasName}\\s+as\\s+([A-Z][A-Za-z0-9_]*)\\s*\\}`);
    const reExportMatch = source.match(reExportPattern);
    if (reExportMatch) {
      const exportName = reExportMatch[1];
      const info = findInternalComponentInfo(source, internalName);
      if (info) {
        return { name: exportName, propsInterfaceName: info };
      }
    }
  }

  return null;
}

/**
 * Given the name of an internal component (e.g. _Button, FormRowComponent),
 * find its props interface name by looking at its definition in the source.
 */
function findInternalComponentInfo(source: string, internalName: string): string | null {
  // Try: const _X = React.forwardRef(function X<T>(props: Props
  const fwdRefFnPat = new RegExp(
    `(?:const|let)\\s+_?${internalName}\\s*=\\s*React\\.forwardRef\\s*\\(\\s*function\\s+[A-Z][A-Za-z0-9_]*\\s*(?:<[^(]*)?(\\()`,
  );
  const fwdRefFnMatch = source.match(fwdRefFnPat);
  if (fwdRefFnMatch && fwdRefFnMatch.index !== undefined) {
    const parenIdx = source.indexOf('(', fwdRefFnMatch.index + fwdRefFnMatch[0].length - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) return propsType;
  }

  // Try: const _X = React.forwardRef<Elem, Props>(
  const fwdRefGenPat = new RegExp(
    `(?:const|let)\\s+_?${internalName}\\s*=\\s*React\\.forwardRef\\s*<[^,>]+,\\s*([A-Za-z][A-Za-z0-9_]*)\\s*>`,
  );
  const fwdRefGenMatch = source.match(fwdRefGenPat);
  if (fwdRefGenMatch) return fwdRefGenMatch[1];

  // Try: const X = ({...}: Props) =>  or  const X = (props: Props) =>
  const arrowPat = new RegExp(
    `(?:const|let|function)\\s+_?${internalName}\\s*=?\\s*(?:<[^(]*)?(\\()`,
  );
  const arrowMatch = source.match(arrowPat);
  if (arrowMatch && arrowMatch.index !== undefined) {
    const parenIdx = source.indexOf('(', arrowMatch.index + arrowMatch[0].length - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) return propsType;
  }

  // Try: function X({...}: Props) or function X(props: Props)
  const fnPat = new RegExp(
    `function\\s+_?${internalName}\\s*(?:<[^(]*)?(\\()`,
  );
  const fnMatch = source.match(fnPat);
  if (fnMatch && fnMatch.index !== undefined) {
    const parenIdx = source.indexOf('(', fnMatch.index + fnMatch[0].length - 1);
    const propsType = extractPropsTypeFromParams(source, parenIdx);
    if (propsType) return propsType;
  }

  return null;
}

/**
 * Handle `export default X` pattern.
 * Look for the component definition of X above the export default.
 */
function extractDefaultExportComponent(source: string): ComponentInfo | null {
  // export default X  (where X is an identifier starting with uppercase)
  const defaultExportMatch = source.match(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?\s*$/m);
  if (!defaultExportMatch) return null;

  const name = defaultExportMatch[1];

  // Try class X extends React.Component<Props>
  const classPattern = new RegExp(
    `(?:export\\s+default\\s+)?class\\s+${name}(?:<[^>]*>)?\\s+extends\\s+React\\.Component\\s*<\\s*([A-Za-z][A-Za-z0-9_]*)`,
  );
  const classMatch = source.match(classPattern);
  if (classMatch) {
    const description = extractJsDocBefore(source, classMatch[0]);
    return { name, propsInterfaceName: classMatch[1], description };
  }

  // Try const X = (props: Props) =>  or  const X = ({...}: Props) =>
  const info = findInternalComponentInfo(source, name);
  if (info) {
    return { name, propsInterfaceName: info };
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
        const filePath = findMainComponentFile(componentDir, entry.name);
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

/**
 * Find the main component .tsx file within a component directory.
 * Searches common locations:
 *   ComponentDir/ComponentName.tsx
 *   ComponentDir/index.tsx
 *   ComponentDir/components/ComponentName.tsx   (e.g. Drawer)
 *   ComponentDir/desktop/ComponentName.tsx      (e.g. Footer)
 *   ComponentDir/mobile/ComponentName.tsx
 */
function findMainComponentFile(componentDir: string, componentName: string): string | null {
  // Direct candidates
  const directCandidates = [
    path.join(componentDir, `${componentName}.tsx`),
    path.join(componentDir, 'index.tsx'),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Search one level of well-known subdirectories
  const subDirs = ['components', 'desktop', 'mobile'];
  for (const subDir of subDirs) {
    const nested = path.join(componentDir, subDir, `${componentName}.tsx`);
    if (fs.existsSync(nested)) return nested;
  }

  return null;
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
