import * as ts from 'typescript';
import path from 'path';

export interface DiscoveredComponent {
  name: string;
  sourceFile: string; // relative path to the .tsx/.ts file defining it
}

/**
 * Walk the export tree of a library's src/index.ts.
 * Find all exported React components (heuristic: PascalCase named exports
 * that are functions or classes, or have a Props interface sibling).
 */
export function discoverComponents(vendorDir: string): DiscoveredComponent[] {
  const absVendorDir = path.resolve(vendorDir);
  const indexPath = path.resolve(absVendorDir, 'src/index.ts');
  const componentsIndexPath = path.resolve(absVendorDir, 'src/components/index.ts');

  // Use whichever exists — components/index.ts is more targeted
  const entryFile = ts.sys.fileExists(componentsIndexPath)
    ? componentsIndexPath
    : indexPath;

  const program = ts.createProgram([entryFile], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    noEmit: true,
    allowJs: true,
    resolveJsonModule: false,
    baseUrl: absVendorDir,
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryFile);
  if (!sourceFile) return [];

  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) return [];

  const exports = checker.getExportsOfModule(symbol);
  const components: DiscoveredComponent[] = [];

  for (const exp of exports) {
    const name = exp.getName();
    // Heuristic: PascalCase (starts with uppercase letter followed by lowercase)
    if (!/^[A-Z][a-z]/.test(name)) continue;
    // Skip known non-components (types, utils)
    if (name.endsWith('Props') || name.endsWith('Type') || name.endsWith('Context')) continue;

    const declarations = exp.getDeclarations();
    if (!declarations || declarations.length === 0) continue;

    const decl = declarations[0];
    const declFile = decl.getSourceFile().fileName;
    const relPath = path.relative(absVendorDir, declFile);

    components.push({ name, sourceFile: relPath });
  }

  return components;
}
