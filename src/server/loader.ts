import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type MiniSearch from "minisearch";
import type { Entity } from "../schemas.js";
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
}

export function loadData(): LoadedData {
  const entitiesDir = join(DATA_DIR, "entities");
  const entities: Entity[] = [];
  if (existsSync(entitiesDir)) {
    const files = readdirSync(entitiesDir).filter(f => f.endsWith(".json")).sort();
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(entitiesDir, file), "utf-8"));
        if (Array.isArray(raw)) entities.push(...(raw as Entity[]));
      } catch { /* skip malformed */ }
    }
  }

  const entityByName = groupBy(entities, e => e.name.toLowerCase());
  const entitiesByLibrary = groupBy(entities, e => e.library);
  const entitiesByType = groupBy(entities, e => e.type);
  const index = buildSearchIndex(entities);

  const libs = new Set(entities.map(e => e.library)).size;
  console.error(`Loaded: ${entities.length} entities, ${libs} libraries`);

  return { entities, entityByName, entitiesByLibrary, entitiesByType, index };
}
