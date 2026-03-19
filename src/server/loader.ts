import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type MiniSearch from "minisearch";
import type { Entity, RecipeDef, Overview } from "../schemas.js";
import { buildSearchIndex } from "./index-builder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, "..", "..", "data");

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

export interface LoadedData {
  entities: Entity[];
  entityByName: Map<string, Entity[]>;
  entitiesByLibrary: Map<string, Entity[]>;
  entitiesByType: Map<string, Entity[]>;
  index: MiniSearch;
  overview: Overview;
  recipes: RecipeDef[];
  recipeById: Map<string, RecipeDef>;
}

export function loadData(): LoadedData {
  const entitiesDir = join(DATA_DIR, "entities");
  const entities: Entity[] = [];
  if (existsSync(entitiesDir)) {
    const files = readdirSync(entitiesDir).filter(f => f.endsWith(".json")).sort();
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(entitiesDir, file), "utf-8"));
        if (Array.isArray(raw)) {
          entities.push(...(raw as Entity[]));
        }
      } catch {
        // skip malformed files
      }
    }
  }

  let overview: Overview = { system: { description: "" }, libraries: [], categories: {}, component_categories: {} };
  const overviewPath = join(DATA_DIR, "overview.json");
  if (existsSync(overviewPath)) {
    try {
      const raw = JSON.parse(readFileSync(overviewPath, "utf-8"));
      if (raw && typeof raw === "object" && raw.system) {
        overview = raw as Overview;
        if (!overview.categories) overview.categories = {};
        if (!overview.component_categories) overview.component_categories = {};
      }
    } catch { /* use default */ }
  }

  const recipesPath = join(DATA_DIR, "recipes.json");
  let recipes: RecipeDef[] = [];
  if (existsSync(recipesPath)) {
    try {
      const raw = JSON.parse(readFileSync(recipesPath, "utf-8"));
      if (Array.isArray(raw)) recipes = raw as RecipeDef[];
    } catch { /* use default */ }
  }

  const entityByName = groupBy(entities, e => e.name);
  const entitiesByLibrary = groupBy(entities, e => e.library);
  const entitiesByType = groupBy(entities, e => e.type);
  const recipeById = new Map(recipes.map(r => [r.id, r]));
  const index = buildSearchIndex(entities, recipes);

  console.error(
    `Loaded: ${entities.length} entities, ${new Set(entities.map(e => e.library)).size} libraries, ${recipes.length} recipes`
  );

  return { entities, entityByName, entitiesByLibrary, entitiesByType, index, overview, recipes, recipeById };
}
