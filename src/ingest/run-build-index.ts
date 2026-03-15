import { writeFileSync } from 'fs';
import { loadJsonArray } from '../server/loader.js';
import { buildIndex, serializeIndex } from './index.js';
import type { Chunk } from '../types.js';

const DATA_DIR = 'data';

const chunks = loadJsonArray<Chunk>(DATA_DIR, 'chunks');
console.log(`Building search index from ${chunks.length} chunks...`);

const index = buildIndex(chunks);
writeFileSync(`${DATA_DIR}/search-index.json`, serializeIndex(index));
console.log(`Search index written to ${DATA_DIR}/search-index.json`);
