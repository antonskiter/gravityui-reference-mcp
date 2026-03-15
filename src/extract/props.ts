import * as ts from 'typescript';
import path from 'path';
import type { PropDef } from '../types.js';

/**
 * Extract props from a TypeScript interface/type alias.
 * Resolves inherited interfaces (extends) and intersection types.
 * Returns flattened array of PropDef.
 */
export function extractProps(
  vendorDir: string,
  relativeFile: string,
  typeName: string,
): PropDef[] {
  const filePath = path.resolve(vendorDir, relativeFile);
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: vendorDir,
  });

  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) return [];

  const symbol = findExportedType(sourceFile, typeName, checker);
  if (!symbol) return [];

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const properties = type.getProperties();
  const results: PropDef[] = [];

  for (const prop of properties) {
    const name = prop.getName();
    if (name.startsWith('_') || name === 'key' || name === 'ref') continue;
    if (name === 'children' || name === 'className' || name === 'style') continue;
    if (/^on[A-Z]/.test(name) && !isOwnProperty(prop, filePath)) continue;

    const declarations = prop.getDeclarations();
    const decl = declarations?.[0];
    const propType = decl
      ? checker.getTypeOfSymbolAtLocation(prop, decl)
      : checker.getTypeOfSymbol(prop);

    const typeString = simplifyType(expandTypeToString(checker, propType));

    const jsDoc = ts.displayPartsToString(prop.getDocumentationComment(checker));
    const jsDocTags = prop.getJsDocTags();
    const deprecated = jsDocTags.some(t => t.name === 'deprecated');
    const defaultTag = jsDocTags.find(t => t.name === 'default');
    const defaultValue = defaultTag
      ? ts.displayPartsToString(defaultTag.text)
      : undefined;

    const required = !(prop.flags & ts.SymbolFlags.Optional);

    results.push({
      name,
      type: typeString,
      required,
      default: defaultValue,
      description: jsDoc || undefined,
      deprecated: deprecated || undefined,
    });
  }

  return results.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Convert a type to string, expanding type aliases one level so that
 * e.g. `ButtonSize` becomes `'xs' | 's' | 'm' | 'l' | 'xl'`.
 */
function expandTypeToString(checker: ts.TypeChecker, type: ts.Type): string {
  // If the type has an alias symbol, try to resolve its target type
  if (type.aliasSymbol) {
    const aliasDecls = type.aliasSymbol.getDeclarations();
    if (aliasDecls && aliasDecls.length > 0) {
      const aliasDecl = aliasDecls[0];
      if (
        ts.isTypeAliasDeclaration(aliasDecl) &&
        ts.isUnionTypeNode(aliasDecl.type)
      ) {
        // It's a union alias — expand by resolving the declared type without alias
        const resolvedType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
        if (resolvedType.isUnion()) {
          const parts = resolvedType.types.map(t =>
            checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation),
          );
          return parts.join(' | ');
        }
      }
    }
  }
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
}

function findExportedType(
  sourceFile: ts.SourceFile,
  name: string,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  const fileSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!fileSymbol) return undefined;
  const exports = checker.getExportsOfModule(fileSymbol);
  return exports.find(e => e.getName() === name);
}

function isOwnProperty(prop: ts.Symbol, filePath: string): boolean {
  const decl = prop.getDeclarations()?.[0];
  return decl?.getSourceFile().fileName === filePath;
}

function simplifyType(typeStr: string): string {
  return typeStr
    .replace(/React\.\w+<(.+?)>/g, '$1')
    .replace(/React\.CSSProperties\["(\w+)"\]/g, '$1 (CSS)')
    .replace(/import\([^)]+\)\./g, '')
    // Normalize double-quoted string literals to single-quoted
    .replace(/"([^"\\]*)"/g, "'$1'");
}
