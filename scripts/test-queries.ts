import { loadData } from "../src/server/loader.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleListComponents } from "../src/server/tools/list-components.js";

const data = loadData();
console.log("=== Smoke Test ===\n");

// Test 1: search "button sizes" limit 3
console.log("--- Test 1: search 'button sizes' (limit 3) ---");
const test1 = handleSearchDocs(data, { query: "button sizes", limit: 3 });
console.log(JSON.stringify(test1, null, 2));
console.log();

// Test 2: search "select" with page_type="component" limit 3
console.log("--- Test 2: search 'select' page_type=component (limit 3) ---");
const test2 = handleSearchDocs(data, { query: "select", page_type: "component", limit: 3 });
console.log(JSON.stringify(test2, null, 2));
console.log();

// Test 3: list_components("uikit") - show first 5
console.log("--- Test 3: list_components('uikit') (first 5 per library) ---");
const test3 = handleListComponents(data, { library: "uikit" });
const truncated3 = {
  libraries: test3.libraries.map(lib => ({
    ...lib,
    components: lib.components.slice(0, 5),
  })),
};
console.log(JSON.stringify(truncated3, null, 2));
console.log();

console.log("=== Smoke Test Complete ===");
