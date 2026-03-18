import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deserializeIndex } from "../ingest/index.js";
import type { Page, Chunk, IngestMetadata, ComponentTags, DesignSystemOverview, ComponentDef, TokenSet, CategoryMap, RecipeDef, HookDef, AssetDef, ApiFunctionDef, ConfigDoc } from "../types.js";
import type MiniSearch from "minisearch";

export type { DesignSystemOverview } from "../types.js";

/**
 * Load and parse a JSON file. Returns fallback on any error (missing file, bad JSON).
 */
export function loadJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function sortByNameOrId<T extends object>(items: T[]): T[] {
  return items.sort((a, b) => {
    const rec = a as Record<string, unknown>;
    const rec2 = b as Record<string, unknown>;
    const keyA = ((rec.name ?? rec.id ?? '') as string);
    const keyB = ((rec2.name ?? rec2.id ?? '') as string);
    return keyA.localeCompare(keyB);
  });
}

/**
 * Load an array from a per-library directory (dataDir/{collectionName}/*.json),
 * concatenating and sorting results. Falls back to dataDir/{collectionName}.json.
 * Returns an empty array when neither exists.
 */
export function loadJsonArray<T extends object>(dataDir: string, collectionName: string): T[] {
  const dirPath = join(dataDir, collectionName);
  if (existsSync(dirPath)) {
    const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
    const items: T[] = [];
    for (const file of files) {
      const parsed = loadJsonFile<T[] | Record<string, unknown>>(join(dirPath, file), []);
      if (Array.isArray(parsed)) {
        items.push(...parsed);
      } else if (parsed && typeof parsed === 'object') {
        // Unwrap objects that nest an array under the collection name
        // e.g. {components: [...]} when collectionName is "components"
        const nested = (parsed as Record<string, unknown>)[collectionName];
        if (Array.isArray(nested)) {
          items.push(...(nested as T[]));
        } else {
          items.push(parsed as T);
        }
      }
    }
    return sortByNameOrId(items);
  }
  const filePath = join(dataDir, `${collectionName}.json`);
  return sortByNameOrId(loadJsonFile<T[]>(filePath, []));
}

/**
 * Load component definitions from data/components/, handling both formats:
 * - Array files: [{name, library, props, ...}, ...]
 * - Object files: {components: [{name, props, ...}], hooks: [...]}
 * Injects library from filename and fills missing defaults.
 */
function loadComponentDefs(dataDir: string): ComponentDef[] {
  const dirPath = join(dataDir, 'components');
  if (!existsSync(dirPath)) return [];
  const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
  const items: ComponentDef[] = [];
  for (const file of files) {
    const libId = file.replace(/\.json$/, '');
    const parsed = loadJsonFile<ComponentDef[] | Record<string, unknown>>(join(dirPath, file), []);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        items.push({ ...item, library: item.library || libId, props: item.props ?? [], examples: item.examples ?? [] });
      }
    } else if (parsed && typeof parsed === 'object') {
      const nested = (parsed as Record<string, unknown>).components;
      if (Array.isArray(nested)) {
        for (const item of nested as ComponentDef[]) {
          items.push({
            ...item,
            library: item.library || libId,
            import_path: item.import_path || `@gravity-ui/${libId}`,
            source_file: item.source_file || '',
            props: item.props ?? [],
            examples: item.examples ?? [],
          });
        }
      }
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load hooks from data/components/ (nested under "hooks" key) and data/utilities/ (if present).
 * Injects library from filename, fills defaults.
 */
function loadHookDefs(dataDir: string): HookDef[] {
  const items: HookDef[] = [];

  // From data/components/*.json — extract "hooks" arrays from wrapper objects
  const componentsDirPath = join(dataDir, 'components');
  if (existsSync(componentsDirPath)) {
    const files = readdirSync(componentsDirPath).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const libId = file.replace(/\.json$/, '');
      const parsed = loadJsonFile<Record<string, unknown> | HookDef[]>(join(componentsDirPath, file), []);
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        const hooks = (parsed as Record<string, unknown>).hooks;
        if (Array.isArray(hooks)) {
          for (const hook of hooks as HookDef[]) {
            items.push({
              ...hook,
              library: hook.library || libId,
              import_path: hook.import_path || `@gravity-ui/${libId}`,
              parameters: hook.parameters ?? [],
              rules_of_hooks: true,
            });
          }
        }
      }
    }
  }

  // From data/utilities/*.json — extract "hooks" arrays if present
  const utilitiesDirPath = join(dataDir, 'utilities');
  if (existsSync(utilitiesDirPath)) {
    const files = readdirSync(utilitiesDirPath).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const libId = file.replace(/\.json$/, '');
      const parsed = loadJsonFile<Record<string, unknown>>(join(utilitiesDirPath, file), {});
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const hooks = (parsed as Record<string, unknown>).hooks;
        if (Array.isArray(hooks)) {
          for (const hook of hooks as HookDef[]) {
            items.push({
              ...hook,
              library: hook.library || libId,
              import_path: hook.import_path || `@gravity-ui/${libId}`,
              parameters: hook.parameters ?? [],
              rules_of_hooks: true,
            });
          }
        }
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load API function definitions from data/utilities/ and data/configs/ (both under "exports" key).
 * Injects library from filename, fills defaults.
 */
function loadApiFunctionDefs(dataDir: string): ApiFunctionDef[] {
  const items: ApiFunctionDef[] = [];

  const dirs = ['utilities', 'configs'];
  for (const dir of dirs) {
    const dirPath = join(dataDir, dir);
    if (!existsSync(dirPath)) continue;
    const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const libId = file.replace(/\.json$/, '');
      const parsed = loadJsonFile<Record<string, unknown> | ApiFunctionDef[]>(join(dirPath, file), []);
      // Single config object with "exports" key
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        const exports = (parsed as Record<string, unknown>).exports;
        if (Array.isArray(exports)) {
          for (const fn of exports as ApiFunctionDef[]) {
            items.push({
              ...fn,
              library: fn.library || libId,
              import_path: fn.import_path || `@gravity-ui/${libId}`,
              parameters: fn.parameters ?? [],
              kind: fn.kind ?? 'function',
            });
          }
        }
      } else if (Array.isArray(parsed)) {
        // Array of config docs — each may have "exports"
        for (const entry of parsed as Array<Record<string, unknown>>) {
          const entryLibId = (entry.library as string) || libId;
          const exports = entry.exports;
          if (Array.isArray(exports)) {
            for (const fn of exports as ApiFunctionDef[]) {
              items.push({
                ...fn,
                library: fn.library || entryLibId,
                import_path: fn.import_path || `@gravity-ui/${entryLibId}`,
                parameters: fn.parameters ?? [],
                kind: fn.kind ?? 'function',
              });
            }
          }
        }
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load asset definitions from data/assets/ (under "assets" key).
 * Injects library from filename, fills defaults.
 */
function loadAssetDefs(dataDir: string): AssetDef[] {
  const items: AssetDef[] = [];

  const dirPath = join(dataDir, 'assets');
  if (!existsSync(dirPath)) return items;

  const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const libId = file.replace(/\.json$/, '');
    const parsed = loadJsonFile<Record<string, unknown> | AssetDef[]>(join(dirPath, file), []);
    if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
      const assets = (parsed as Record<string, unknown>).assets;
      if (Array.isArray(assets)) {
        for (const asset of assets as AssetDef[]) {
          items.push({
            ...asset,
            library: asset.library || libId,
            import_path: asset.import_path || `@gravity-ui/${libId}`,
          });
        }
      }
    } else if (Array.isArray(parsed)) {
      for (const asset of parsed as AssetDef[]) {
        items.push({
          ...asset,
          library: asset.library || libId,
          import_path: asset.import_path || `@gravity-ui/${libId}`,
        });
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load config docs from data/configs/ (both single-object and array formats).
 * Injects library from filename.
 */
function loadConfigDocs(dataDir: string): ConfigDoc[] {
  const items: ConfigDoc[] = [];

  const dirPath = join(dataDir, 'configs');
  if (!existsSync(dirPath)) return items;

  const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();
  for (const file of files) {
    const libId = file.replace(/\.json$/, '');
    const parsed = loadJsonFile<ConfigDoc | ConfigDoc[]>(join(dirPath, file), [] as ConfigDoc[]);
    if (Array.isArray(parsed)) {
      for (const doc of parsed) {
        items.push({ ...doc, library: doc.library || libId });
      }
    } else if (parsed && typeof parsed === 'object') {
      items.push({ ...parsed, library: (parsed as ConfigDoc).library || libId });
    }
  }

  return items.sort((a, b) => a.library.localeCompare(b.library));
}

/**
 * Load a required JSON file, exiting the process if missing or unparseable.
 */
function loadRequiredJson<T>(filePath: string, description: string): T {
  if (!existsSync(filePath)) {
    console.error(`Missing required file: ${description} (${filePath})`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch (e) {
    console.error(`Failed to parse ${description} (${filePath}): ${e}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "..", "data");

export interface LoadedData {
  pages: Page[];
  chunks: Chunk[];
  metadata: IngestMetadata;
  index: MiniSearch;
  pageById: Map<string, Page>;
  chunkById: Map<string, Chunk>;
  chunksByPageId: Map<string, Chunk[]>;
  tagsByPageId: Map<string, string[]>;
  overview: DesignSystemOverview;
  componentDefs: ComponentDef[];
  componentByName: Map<string, ComponentDef[]>;
  componentsByLibrary: Map<string, ComponentDef[]>;
  tokens: TokenSet;
  categoryMap: CategoryMap;
  recipes: RecipeDef[];
  recipeById: Map<string, RecipeDef>;
  hooks: HookDef[];
  hooksByLibrary: Map<string, HookDef[]>;
  apiFunctions: ApiFunctionDef[];
  apiFunctionsByLibrary: Map<string, ApiFunctionDef[]>;
  assets: AssetDef[];
  assetsByLibrary: Map<string, AssetDef[]>;
  configDocs: ConfigDoc[];
}

export function loadData(): LoadedData {
  const pages: Page[] = loadJsonArray<Page>(DATA_DIR, "pages");
  const chunks: Chunk[] = loadJsonArray<Chunk>(DATA_DIR, "chunks");
  const metadata: IngestMetadata = loadRequiredJson<IngestMetadata>(join(DATA_DIR, "metadata.json"), "metadata");
  const searchIndexPath = join(DATA_DIR, "search-index.json");
  if (!existsSync(searchIndexPath)) {
    console.error(`Missing required file: search-index (${searchIndexPath})`);
    process.exit(1);
  }
  let indexJson: string;
  try {
    indexJson = readFileSync(searchIndexPath, "utf-8");
  } catch (e) {
    console.error(`Failed to read search-index (${searchIndexPath}): ${e}`);
    process.exit(1);
  }
  const index = deserializeIndex(indexJson);
  const tagsRaw: ComponentTags = loadRequiredJson<ComponentTags>(join(DATA_DIR, "tags.json"), "tags");
  const overview: DesignSystemOverview = loadRequiredJson<DesignSystemOverview>(join(DATA_DIR, "overview.json"), "overview");

  const pageById = new Map(pages.map(p => [p.id, p]));
  const chunkById = new Map(chunks.map(c => [c.id, c]));
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) || [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  const tagsByPageId = new Map(Object.entries(tagsRaw));

  // Load new extraction data (graceful fallback if not yet extracted)
  const componentDefs: ComponentDef[] = loadComponentDefs(DATA_DIR);
  const tokens: TokenSet = loadJsonFile<TokenSet>(join(DATA_DIR, "tokens.json"), { colors: {}, spacing: {}, breakpoints: {}, sizes: {} });
  const categoryMap: CategoryMap = loadJsonFile<CategoryMap>(join(DATA_DIR, "categories.json"), { categories: {}, components: {} });

  // Load recipes (optional file, graceful fallback)
  const recipes: RecipeDef[] = loadJsonFile<RecipeDef[]>(join(DATA_DIR, "recipes.json"), []);

  const recipeById = new Map<string, RecipeDef>();
  for (const recipe of recipes) {
    recipeById.set(recipe.id, recipe);
  }

  // Index recipe content into MiniSearch for unified search
  if (recipes.length > 0) {
    const avoidItems = (r: RecipeDef): string[] => {
      for (const s of r.sections) {
        if (s.type === 'avoid') return s.items;
      }
      return [];
    };
    index.addAll(recipes.map(r => ({
      id: `recipe:${r.id}`,
      page_title: r.title,
      section_title: 'Recipe',
      keywords_joined: r.tags.join(' '),
      content: [r.description, ...r.use_cases, ...avoidItems(r)].join(' '),
    })));
  }

  // Build lookup maps
  const componentByName = new Map<string, ComponentDef[]>();
  for (const comp of componentDefs) {
    const list = componentByName.get(comp.name) || [];
    list.push(comp);
    componentByName.set(comp.name, list);
  }
  const componentsByLibrary = new Map<string, ComponentDef[]>();
  for (const comp of componentDefs) {
    const list = componentsByLibrary.get(comp.library) || [];
    list.push(comp);
    componentsByLibrary.set(comp.library, list);
  }

  // Load hooks
  const hooks = loadHookDefs(DATA_DIR);
  const hooksByLibrary = new Map<string, HookDef[]>();
  for (const h of hooks) {
    const list = hooksByLibrary.get(h.library) || [];
    list.push(h);
    hooksByLibrary.set(h.library, list);
  }

  // Load API functions
  const apiFunctions = loadApiFunctionDefs(DATA_DIR);
  const apiFunctionsByLibrary = new Map<string, ApiFunctionDef[]>();
  for (const fn of apiFunctions) {
    const list = apiFunctionsByLibrary.get(fn.library) || [];
    list.push(fn);
    apiFunctionsByLibrary.set(fn.library, list);
  }

  // Load assets
  const assets = loadAssetDefs(DATA_DIR);
  const assetsByLibrary = new Map<string, AssetDef[]>();
  for (const asset of assets) {
    const list = assetsByLibrary.get(asset.library) || [];
    list.push(asset);
    assetsByLibrary.set(asset.library, list);
  }

  // Load config docs
  const configDocs = loadConfigDocs(DATA_DIR);

  console.log(
    `Loaded: ${pages.length} pages, ${chunks.length} chunks, ${componentDefs.length} components, ` +
    `${hooks.length} hooks, ${apiFunctions.length} API fns, ${assets.length} assets, ${configDocs.length} config docs, ` +
    `${recipes.length} recipes`
  );

  return { pages, chunks, metadata, index, pageById, chunkById, chunksByPageId, tagsByPageId, overview, componentDefs, componentByName, componentsByLibrary, tokens, categoryMap, recipes, recipeById, hooks, hooksByLibrary, apiFunctions, apiFunctionsByLibrary, assets, assetsByLibrary, configDocs };
}
