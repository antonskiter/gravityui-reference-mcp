import { loadData } from "../src/server/loader.js";
import { handleSearchDocs, formatSearchDocs } from "../src/server/tools/search-docs.js";
import { handleListComponents, formatListComponents } from "../src/server/tools/list-components.js";
import { handleSuggestComponent, formatSuggestComponent } from "../src/server/tools/suggest-component.js";
import { handleGetComponent, formatGetComponent } from "../src/server/tools/get-component.js";
import { handleGetDesignTokens, formatGetDesignTokens } from "../src/server/tools/get-design-tokens.js";

const data = loadData();
console.log("=== Gravity UI MCP v2 Smoke Test ===\n");

// Test 1: list_components({}) — all components grouped by category
console.log("--- Test 1: list_components({}) — all components ---");
const test1 = handleListComponents(data, {});
console.log(`Total: ${test1.totalCount} components in ${test1.groups.length} categories`);
console.log("Categories:", test1.groups.map(g => `${g.displayName} (${g.components.length})`).join(", "));
console.log();

// Test 2: list_components({category: 'layout'}) — layout components with descriptions
console.log("--- Test 2: list_components({category: 'layout'}) ---");
const test2 = handleListComponents(data, { category: "layout" });
console.log(formatListComponents(test2));
console.log();

// Test 3: suggest_component({use_case: 'dropdown with search'}) — should suggest Select
console.log("--- Test 3: suggest_component({use_case: 'dropdown with search'}) ---");
const test3 = handleSuggestComponent(data, { use_case: "dropdown with search" });
console.log(formatSuggestComponent(test3));
const selectFound = test3.suggestions.some(s => s.component.toLowerCase() === "select");
console.log(`Select in suggestions: ${selectFound}`);
console.log();

// Test 4: get_component({name: 'Flex'}) — should return TypeScript interface with direction, gap, etc.
console.log("--- Test 4: get_component({name: 'Flex'}) ---");
const test4 = handleGetComponent(data, { name: "Flex" });
console.log(formatGetComponent(test4, "compact"));
const flexProps = test4.component?.props.map(p => p.name) ?? [];
const hasDirOrGap = flexProps.includes("direction") || flexProps.includes("gap") || flexProps.some(p => p.includes("direction") || p.includes("gap"));
console.log(`Flex props include direction/gap: ${hasDirOrGap} (props: ${flexProps.slice(0, 8).join(", ")})`);
console.log();

// Test 5: get_component({name: 'Button', detail: 'full'}) — full props
console.log("--- Test 5: get_component({name: 'Button', detail: 'full'}) ---");
const test5 = handleGetComponent(data, { name: "Button", detail: "full" });
if (test5.component) {
  console.log(`Button found with ${test5.component.props.length} props`);
  console.log("First 5 props:", test5.component.props.slice(0, 5).map(p => p.name).join(", "));
} else {
  console.log("ERROR:", test5.error);
}
console.log();

// Test 6: get_design_tokens({topic: 'spacing'}) — spacing scale
console.log("--- Test 6: get_design_tokens({topic: 'spacing'}) ---");
const test6 = handleGetDesignTokens(data, { topic: "spacing" });
console.log(formatGetDesignTokens(test6));
console.log();

// Test 7: search_docs({query: 'how to customize theme'}) — behavioral search
console.log("--- Test 7: search_docs({query: 'how to customize theme'}) ---");
const test7 = handleSearchDocs(data, { query: "how to customize theme", limit: 3 });
console.log(formatSearchDocs(test7));
console.log();

// Summary
console.log("=== Summary ===");
console.log(`1. list_components({}): ${test1.totalCount} components, ${test1.groups.length} categories — ${test1.totalCount > 0 ? "PASS" : "FAIL"}`);
const layoutGroup = test2.groups.find(g => g.category === "layout");
const layoutNames = layoutGroup?.components.map(c => c.name) ?? [];
const layoutOk = ["Flex", "Box", "Row", "Col", "Container"].every(n => layoutNames.includes(n));
console.log(`2. list_components(layout): Flex/Box/Row/Col/Container present — ${layoutOk ? "PASS" : "FAIL"} (found: ${layoutNames.join(", ")})`);
console.log(`3. suggest_component(dropdown with search): Select suggested — ${selectFound ? "PASS" : "FAIL"}`);
console.log(`4. get_component(Flex): found ${test4.component ? "yes" : "no"}, has direction/gap — ${hasDirOrGap ? "PASS" : "FAIL"}`);
console.log(`5. get_component(Button, full): ${test5.component ? `${test5.component.props.length} props — PASS` : "FAIL"}`);
const spacingOk = test6.spacing && Object.keys(test6.spacing).length > 0;
console.log(`6. get_design_tokens(spacing): ${spacingOk ? `${Object.keys(test6.spacing!).length} values — PASS` : "FAIL"}`);
const searchOk = test7.results && test7.results.length > 0;
console.log(`7. search_docs(theme): ${searchOk ? `${test7.results.length} results — PASS` : "FAIL"}`);
console.log();

// Test 8: suggest_component for flexbox layout — should suggest Flex
console.log("--- Test 8: suggest_component({use_case: 'flexbox layout'}) ---");
const test8 = handleSuggestComponent(data, { use_case: "flexbox layout" });
console.log(formatSuggestComponent(test8));
const flexFound = test8.suggestions.some(s => s.component.toLowerCase() === "flex");
console.log(`Flex in suggestions: ${flexFound}`);
console.log(`8. suggest_component(flexbox layout): Flex suggested — ${flexFound ? "PASS" : "FAIL"}`);

console.log("\n=== Smoke Test Complete ===");
