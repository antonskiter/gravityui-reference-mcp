import { z } from "zod";
import { join } from "path";
import { existsSync } from "fs";
import {
  ComponentDefSchema,
  PageSchema,
  ChunkSchema,
  TokenSetSchema,
  ComponentTagsSchema,
  DesignSystemOverviewSchema,
} from "../schemas.js";
import { loadJsonArray, loadJsonFile } from "../server/loader.js";

export interface ValidationResult {
  fatal: boolean;
  errors: string[];
  warnings: string[];
}

export interface ManifestEntry {
  library: string;
}

export interface Manifest {
  entries: ManifestEntry[];
}

function tryParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string,
  result: ValidationResult
): T | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      result.errors.push(`[${label}] ${issue.path.join('.')} — ${issue.message}`);
    }
    result.fatal = true;
    return null;
  }
  return parsed.data;
}

export function validateDataDir(dataDir: string, manifest?: Manifest): ValidationResult {
  const result: ValidationResult = { fatal: false, errors: [], warnings: [] };

  // 1. Validate components
  const rawComponents = loadJsonArray(dataDir, 'components');
  const components = tryParse(z.array(ComponentDefSchema), rawComponents, 'components', result);

  // 2. Validate pages
  const rawPages = loadJsonArray(dataDir, 'pages');
  const pages = tryParse(z.array(PageSchema), rawPages, 'pages', result);

  // 3. Validate chunks
  const rawChunks = loadJsonArray(dataDir, 'chunks');
  const chunks = tryParse(z.array(ChunkSchema), rawChunks, 'chunks', result);

  // 4. Validate tokens (optional file)
  const tokensPath = join(dataDir, 'tokens.json');
  if (existsSync(tokensPath)) {
    const rawTokens = loadJsonFile(tokensPath, {});
    tryParse(TokenSetSchema, rawTokens, 'tokens', result);
  }

  // 5. Validate tags (optional file)
  const tagsPath = join(dataDir, 'tags.json');
  let tags: Record<string, string[]> | null = null;
  if (existsSync(tagsPath)) {
    const rawTags = loadJsonFile(tagsPath, {});
    tags = tryParse(ComponentTagsSchema, rawTags, 'tags', result);
  }

  // 6. Validate overview (optional file)
  const overviewPath = join(dataDir, 'overview.json');
  if (existsSync(overviewPath)) {
    const rawOverview = loadJsonFile(overviewPath, {});
    tryParse(DesignSystemOverviewSchema, rawOverview, 'overview', result);
  }

  // Cross-reference checks (only if core data parsed successfully)
  if (pages && chunks) {
    const pageIds = new Set(pages.map(p => p.id));

    // 7a. Chunks referencing non-existent page IDs
    for (const chunk of chunks) {
      if (!pageIds.has(chunk.page_id)) {
        result.warnings.push(
          `Chunk "${chunk.id}" references non-existent page_id "${chunk.page_id}"`
        );
      }
    }

    // 7b. Tag keys referencing non-existent page IDs
    if (tags) {
      for (const pageId of Object.keys(tags)) {
        if (!pageIds.has(pageId)) {
          result.warnings.push(
            `Tag key "${pageId}" references non-existent page`
          );
        }
      }
    }
  }

  // 7c. Components with descriptions but empty props
  if (components) {
    for (const comp of components) {
      if (comp.description && comp.props.length === 0) {
        result.warnings.push(
          `Component "${comp.name}" (${comp.library}) has a description but no props`
        );
      }
    }
  }

  // 8. Manifest coverage check
  if (manifest && components) {
    const librariesWithComponents = new Set(components.map(c => c.library));
    for (const entry of manifest.entries) {
      if (!librariesWithComponents.has(entry.library)) {
        result.warnings.push(
          `Manifest library "${entry.library}" has no components in data`
        );
      }
    }
  }

  return result;
}
