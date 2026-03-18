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
 * Determine if a bare-array entry looks like a hook rather than a component.
 * A hook entry has `rules_of_hooks: true` or `is_hook: true`, OR has a
 * `signature` and `return_type` but lacks a `props` array.
 */
function looksLikeHook(entry: Record<string, unknown>): boolean {
  if (entry.rules_of_hooks === true || entry.is_hook === true) return true;
  if (
    typeof entry.signature === 'string' &&
    typeof entry.return_type === 'string' &&
    !Array.isArray(entry.props)
  ) return true;
  return false;
}

/**
 * Generic helper: read all JSON files from dataDir/dirName/, extract entities
 * using extractKey (or top-level array), and normalize each item.
 *
 * extractKey behaviour:
 *   - string (e.g. 'hooks'): for object-format files, read parsed[extractKey]
 *   - null: for object-format files, treat the entire object as one item;
 *           for array-format files, use entries directly
 *
 * filter: optional predicate applied after extraction, before normalize
 */
function loadEntitiesFromDir<T extends { name?: string; library?: string }>(
  dataDir: string,
  dirName: string,
  extractKey: string | null,
  normalize: (item: Record<string, unknown>, libId: string) => T,
  filter?: (item: Record<string, unknown>) => boolean,
): T[] {
  const dirPath = join(dataDir, dirName);
  if (!existsSync(dirPath)) return [];

  const items: T[] = [];
  const files = readdirSync(dirPath).filter(f => f.endsWith('.json')).sort();

  for (const file of files) {
    const libId = file.replace(/\.json$/, '');
    const parsed = loadJsonFile<Record<string, unknown> | unknown[]>(join(dirPath, file), []);

    let candidates: Record<string, unknown>[] = [];

    if (Array.isArray(parsed)) {
      if (extractKey === null) {
        candidates = parsed as Record<string, unknown>[];
      }
      // When extractKey is set but file is an array, check each element for the key
      else {
        for (const entry of parsed as Record<string, unknown>[]) {
          const nested = entry[extractKey];
          if (Array.isArray(nested)) {
            candidates.push(...(nested as Record<string, unknown>[]));
          }
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      if (extractKey === null) {
        candidates = [parsed as Record<string, unknown>];
      } else {
        const nested = (parsed as Record<string, unknown>)[extractKey];
        if (Array.isArray(nested)) {
          candidates = nested as Record<string, unknown>[];
        }
      }
    }

    for (const candidate of candidates) {
      if (filter && !filter(candidate)) continue;
      items.push(normalize(candidate, libId));
    }
  }

  return items;
}

/**
 * Load component definitions from data/components/, handling both formats:
 * - Array files: [{name, library, props, ...}, ...]  (skips hook-like entries)
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
      for (const item of parsed as Record<string, unknown>[]) {
        // Skip hook-like entries in bare-array files
        if (looksLikeHook(item)) continue;
        const comp = item as ComponentDef;
        items.push({ ...comp, library: comp.library || libId, props: comp.props ?? [], examples: comp.examples ?? [] });
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
 * Normalize a raw hook record into a HookDef.
 */
function normalizeHook(raw: Record<string, unknown>, libId: string): HookDef {
  const hook = raw as HookDef;
  return {
    ...hook,
    library: hook.library || libId,
    import_path: hook.import_path || `@gravity-ui/${libId}`,
    parameters: hook.parameters ?? [],
    rules_of_hooks: true,
  };
}

/**
 * Load hooks from data/components/ (nested under "hooks" key, or bare-array entries
 * with rules_of_hooks/is_hook markers) and data/utilities/ (if present).
 * Injects library from filename, fills defaults.
 */
function loadHookDefs(dataDir: string): HookDef[] {
  const items: HookDef[] = [];

  // From data/components/*.json
  const componentsDirPath = join(dataDir, 'components');
  if (existsSync(componentsDirPath)) {
    const files = readdirSync(componentsDirPath).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const libId = file.replace(/\.json$/, '');
      const parsed = loadJsonFile<Record<string, unknown> | HookDef[]>(join(componentsDirPath, file), []);

      if (Array.isArray(parsed)) {
        // Bare-array format: extract hook-like entries
        for (const entry of parsed as Record<string, unknown>[]) {
          if (looksLikeHook(entry)) {
            items.push(normalizeHook(entry, libId));
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        // Wrapper object format: read from "hooks" key
        const hooks = (parsed as Record<string, unknown>).hooks;
        if (Array.isArray(hooks)) {
          for (const hook of hooks as Record<string, unknown>[]) {
            items.push(normalizeHook(hook, libId));
          }
        }
      }
    }
  }

  // From data/utilities/*.json — extract "hooks" arrays using generic helper
  const utilitiesHooks = loadEntitiesFromDir<HookDef>(
    dataDir,
    'utilities',
    'hooks',
    normalizeHook,
  );
  items.push(...utilitiesHooks);

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize a raw API function record into an ApiFunctionDef.
 */
function normalizeApiFunction(raw: Record<string, unknown>, libId: string): ApiFunctionDef {
  const fn = raw as ApiFunctionDef;
  return {
    ...fn,
    library: fn.library || libId,
    import_path: fn.import_path || `@gravity-ui/${libId}`,
    parameters: fn.parameters ?? [],
    kind: fn.kind ?? 'function',
  };
}

/**
 * Load API function definitions from data/utilities/ and data/configs/ (both under "exports" key).
 * Injects library from filename, fills defaults.
 */
function loadApiFunctionDefs(dataDir: string): ApiFunctionDef[] {
  const items: ApiFunctionDef[] = [];

  for (const dir of ['utilities', 'configs'] as const) {
    const dirFns = loadEntitiesFromDir<ApiFunctionDef>(
      dataDir,
      dir,
      'exports',
      normalizeApiFunction,
    );
    items.push(...dirFns);
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize a raw asset record into an AssetDef.
 */
function normalizeAsset(raw: Record<string, unknown>, libId: string): AssetDef {
  const asset = raw as AssetDef;
  return {
    ...asset,
    library: asset.library || libId,
    import_path: asset.import_path || `@gravity-ui/${libId}`,
  };
}

/**
 * Load asset definitions from data/assets/ (under "assets" key).
 * Injects library from filename, fills defaults.
 */
function loadAssetDefs(dataDir: string): AssetDef[] {
  const items = loadEntitiesFromDir<AssetDef>(
    dataDir,
    'assets',
    'assets',
    normalizeAsset,
  );
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Normalize a raw config doc record into a ConfigDoc.
 */
function normalizeConfigDoc(raw: Record<string, unknown>, libId: string): ConfigDoc {
  const doc = raw as ConfigDoc;
  return { ...doc, library: doc.library || libId };
}

/**
 * Load config docs from data/configs/ (both single-object and array formats).
 * Injects library from filename.
 */
function loadConfigDocs(dataDir: string): ConfigDoc[] {
  const items = loadEntitiesFromDir<ConfigDoc>(
    dataDir,
    'configs',
    null,
    normalizeConfigDoc,
  );
  return items.sort((a, b) => a.library.localeCompare(b.library));
}

/**
 * Load a required JSON file, throwing if missing or unparseable.
 */
function loadRequiredJson<T>(filePath: string, description: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Missing required data file: ${description} (${filePath})`);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch (e) {
    throw new Error(`Failed to parse ${description} (${filePath}): ${e}`);
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
    throw new Error(`Missing required data file: search-index (${searchIndexPath})`);
  }
  let indexJson: string;
  try {
    indexJson = readFileSync(searchIndexPath, "utf-8");
  } catch (e) {
    throw new Error(`Failed to read search-index (${searchIndexPath}): ${e}`);
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
