import { loadData } from "../src/server/loader.js";
import { handleSearchDocs } from "../src/server/tools/search-docs.js";
import { handleGetSection } from "../src/server/tools/get-section.js";
import { handleGetPage } from "../src/server/tools/get-page.js";
import { handleListComponents } from "../src/server/tools/list-components.js";
import { handleListSources } from "../src/server/tools/list-sources.js";

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

// Test 3: get_section using first result from test 1
console.log("--- Test 3: get_section using first result from test 1 ---");
if (test1.results.length > 0) {
  const sectionId = test1.results[0].section_id;
  const test3 = handleGetSection(data, { section_id: sectionId });
  console.log(JSON.stringify(test3, null, 2));
} else {
  console.log("No results from test 1, skipping.");
}
console.log();

// Test 4: get_page("guide:Button")
console.log("--- Test 4: get_page('guide:Button') ---");
const test4 = handleGetPage(data, { page_id: "guide:Button" });
console.log(JSON.stringify(test4, null, 2));
console.log();

// Test 5: list_components("uikit") - show first 5
console.log("--- Test 5: list_components('uikit') (first 5 per library) ---");
const test5 = handleListComponents(data, { library: "uikit" });
const truncated5 = {
  libraries: test5.libraries.map(lib => ({
    ...lib,
    components: lib.components.slice(0, 5),
  })),
};
console.log(JSON.stringify(truncated5, null, 2));
console.log();

// Test 6: list_sources()
console.log("--- Test 6: list_sources() ---");
const test6 = handleListSources(data);
console.log(JSON.stringify(test6, null, 2));
console.log();

console.log("=== Smoke Test Complete ===");
