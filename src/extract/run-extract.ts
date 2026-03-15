import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverComponents } from './components.js';
import { extractProps } from './props.js';
import { extractStoryExamples } from './stories.js';
import { extractTokens } from './tokens.js';
import { parsePage } from '../ingest/parse.js';
import type { ComponentDef } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const VENDOR_DIR = path.join(ROOT, 'vendor');
const DATA_DIR = path.join(ROOT, 'data');

const COMPONENT_LIBRARIES: Record<string, string> = {
  uikit: '@gravity-ui/uikit',
  components: '@gravity-ui/components',
  'date-components': '@gravity-ui/date-components',
  navigation: '@gravity-ui/navigation',
  'markdown-editor': '@gravity-ui/markdown-editor',
};

const PROPS_TYPE_SUFFIXES = ['Props', 'CommonProps', 'PublicProps'];

function tryReadFile(filePath: string): string | null {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

function findStoryFile(vendorDir: string, componentSourceFile: string, componentName: string): string | null {
  // componentSourceFile is like "src/components/Button/Button.tsx"
  const componentDir = path.join(vendorDir, path.dirname(componentSourceFile));
  const parentDir = path.dirname(componentDir);

  const candidates = [
    path.join(componentDir, '__stories__', `${componentName}.stories.tsx`),
    path.join(componentDir, '__stories__', `${componentName}.stories.ts`),
    path.join(parentDir, '__stories__', `${componentName}.stories.tsx`),
    path.join(parentDir, '__stories__', `${componentName}.stories.ts`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findReadmeFile(vendorDir: string, componentSourceFile: string): string | null {
  const componentDir = path.join(vendorDir, path.dirname(componentSourceFile));
  const parentDir = path.dirname(componentDir);

  const candidates = [
    path.join(componentDir, 'README.md'),
    path.join(parentDir, 'README.md'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function extractDescription(vendorDir: string, componentSourceFile: string, componentName: string): string | undefined {
  const readmePath = findReadmeFile(vendorDir, componentSourceFile);
  if (!readmePath) return undefined;

  const content = tryReadFile(readmePath);
  if (!content) return undefined;

  try {
    const result = parsePage(content, 'component', componentName);
    return result.description || undefined;
  } catch {
    return undefined;
  }
}

function extractPropsForComponent(
  vendorDir: string,
  sourceFile: string,
  componentName: string,
): ReturnType<typeof extractProps> {
  for (const suffix of PROPS_TYPE_SUFFIXES) {
    const typeName = `${componentName}${suffix}`;
    try {
      const props = extractProps(vendorDir, sourceFile, typeName);
      if (props.length > 0) return props;
    } catch {
      // try next suffix
    }
  }
  return [];
}

async function processLibrary(
  libraryKey: string,
  packageName: string,
): Promise<ComponentDef[]> {
  const vendorDir = path.join(VENDOR_DIR, libraryKey);

  if (!fs.existsSync(vendorDir)) {
    console.log(`  [skip] vendor/${libraryKey} does not exist`);
    return [];
  }

  console.log(`\nProcessing ${packageName} (vendor/${libraryKey})...`);

  let discovered: { name: string; sourceFile: string }[];
  try {
    discovered = discoverComponents(vendorDir);
  } catch (err) {
    console.error(`  [error] discoverComponents failed for ${libraryKey}:`, (err as Error).message);
    return [];
  }

  console.log(`  Discovered ${discovered.length} components`);

  const results: ComponentDef[] = [];

  for (const component of discovered) {
    const { name, sourceFile } = component;
    process.stdout.write(`  [${name}] extracting props...`);

    const props = extractPropsForComponent(vendorDir, sourceFile, name);
    process.stdout.write(` ${props.length} props`);

    const storyFile = findStoryFile(vendorDir, sourceFile, name);
    const examples = storyFile ? extractStoryExamples(storyFile) : [];
    process.stdout.write(`, ${examples.length} examples`);

    const description = extractDescription(vendorDir, sourceFile, name);
    process.stdout.write(description ? ', description found' : ', no description');
    process.stdout.write('\n');

    results.push({
      name,
      library: libraryKey,
      import_path: packageName,
      import_statement: `import {${name}} from '${packageName}';`,
      props,
      examples,
      description,
      source_file: `${libraryKey}/${sourceFile}`,
    });
  }

  return results;
}

async function main() {
  console.log('=== Gravity UI Extraction Pipeline ===\n');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const allComponents: ComponentDef[] = [];

  for (const [libraryKey, packageName] of Object.entries(COMPONENT_LIBRARIES)) {
    const components = await processLibrary(libraryKey, packageName);
    allComponents.push(...components);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total components extracted: ${allComponents.length}`);

  // Extract tokens from uikit
  console.log('\nExtracting tokens from uikit...');
  const uikitVendorDir = path.join(VENDOR_DIR, 'uikit');
  let tokens = {};
  if (fs.existsSync(uikitVendorDir)) {
    try {
      tokens = extractTokens(uikitVendorDir);
      console.log('  Tokens extracted successfully');
    } catch (err) {
      console.error('  [error] extractTokens failed:', (err as Error).message);
    }
  } else {
    console.log('  [skip] vendor/uikit does not exist');
  }

  // Write outputs
  const componentsPath = path.join(DATA_DIR, 'components.json');
  const tokensPath = path.join(DATA_DIR, 'tokens.json');

  fs.writeFileSync(componentsPath, JSON.stringify(allComponents, null, 2), 'utf-8');
  console.log(`\nWrote ${allComponents.length} components to data/components.json`);

  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log('Wrote tokens to data/tokens.json');

  // Log per-library breakdown
  console.log('\nPer-library breakdown:');
  for (const [libraryKey, packageName] of Object.entries(COMPONENT_LIBRARIES)) {
    const count = allComponents.filter(c => c.library === libraryKey).length;
    console.log(`  ${packageName}: ${count} components`);
  }

  // Optional: check for uncategorized (data/categories.json may not exist yet)
  const categoriesPath = path.join(DATA_DIR, 'categories.json');
  if (fs.existsSync(categoriesPath)) {
    try {
      const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8')) as Record<string, string[]>;
      const categorized = new Set(Object.values(categories).flat());
      const uncategorized = allComponents.filter(c => !categorized.has(c.name));
      if (uncategorized.length > 0) {
        console.log(`\nUncategorized components (${uncategorized.length}):`);
        for (const c of uncategorized) {
          console.log(`  ${c.library}/${c.name}`);
        }
      }
    } catch {
      // skip
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
