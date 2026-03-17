/**
 * Smoke test for all MCP tools (v1.0.0: find/get/list).
 * Run: pnpm build && npx tsx src/server/smoke-test.ts
 */

const ROOT = new URL("../../dist/", import.meta.url).pathname;

const { loadData } = await import(`${ROOT}server/loader.js`);
const { handleFind, formatFind } = await import(`${ROOT}server/tools/find.js`);
const { handleGet, formatGet } = await import(`${ROOT}server/tools/get.js`);
const { handleList, formatList } = await import(`${ROOT}server/tools/list.js`);

const data = loadData();
console.log(`Loaded: ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components, ${data.recipes.length} recipes\n`);

interface TestCase {
  name: string;
  run: () => string;
  check: (output: string) => { pass: boolean; reason: string };
}

const tests: TestCase[] = [
  // --- 1. find("confirmation dialog") ---
  {
    name: 'find — "confirmation dialog"',
    run: () => formatFind(handleFind(data, { query: "confirmation dialog" })),
    check: (out: string) => {
      const hasRecipe = out.includes('[recipe]');
      const hasComponent = out.includes('[component]');
      return {
        pass: hasRecipe || hasComponent,
        reason: `recipe=${hasRecipe}, component=${hasComponent}`,
      };
    },
  },
  // --- 2. find("something that doesnt exist") ---
  {
    name: 'find — "something that doesnt exist"',
    run: () => formatFind(handleFind(data, { query: "xyzzy nonexistent thing" })),
    check: (out: string) => {
      const isEmpty = out.includes('No matches') || out.startsWith('0 results');
      return { pass: true, reason: isEmpty ? 'empty results (expected)' : `got results: ${out.slice(0, 100)}` };
    },
  },
  // --- 3. get("Button") ---
  {
    name: 'get — "Button"',
    run: () => formatGet(handleGet(data, { name: "Button" }), "compact"),
    check: (out: string) => {
      const hasImport = out.includes('import');
      const hasProps = out.includes('Props');
      return { pass: hasImport && hasProps, reason: `import=${hasImport}, props=${hasProps}` };
    },
  },
  // --- 4. get("confirmation-dialog") ---
  {
    name: 'get — "confirmation-dialog"',
    run: () => formatGet(handleGet(data, { name: "confirmation-dialog" }), "compact"),
    check: (out: string) => {
      const hasWhen = out.includes('When:');
      const hasComponents = out.includes('Components:');
      return { pass: hasWhen || hasComponents, reason: `when=${hasWhen}, components=${hasComponents}` };
    },
  },
  // --- 5. get("spacing") ---
  {
    name: 'get — "spacing"',
    run: () => formatGet(handleGet(data, { name: "spacing" }), "compact"),
    check: (out: string) => {
      const hasValues = out.includes('px') || out.includes('Spacing');
      return { pass: hasValues, reason: hasValues ? 'has token values' : 'no token values' };
    },
  },
  // --- 6. get("uikit") ---
  {
    name: 'get — "uikit"',
    run: () => formatGet(handleGet(data, { name: "uikit" }), "compact"),
    check: (out: string) => {
      const hasPackage = out.includes('@gravity-ui/uikit');
      const hasComponents = out.includes('components');
      return { pass: hasPackage, reason: `package=${hasPackage}, components=${hasComponents}` };
    },
  },
  // --- 7. get("overview") ---
  {
    name: 'get — "overview"',
    run: () => formatGet(handleGet(data, { name: "overview" }), "compact"),
    check: (out: string) => {
      const hasSystem = out.includes('Gravity UI') || out.includes('Design System');
      const hasLibraries = out.includes('libraries');
      return { pass: hasSystem, reason: `system=${hasSystem}, libraries=${hasLibraries}` };
    },
  },
  // --- 8. get("NonExistent") ---
  {
    name: 'get — "NonExistent"',
    run: () => formatGet(handleGet(data, { name: "NonExistent" }), "compact"),
    check: (out: string) => {
      const isNotFound = out.includes('not found');
      return { pass: isNotFound, reason: isNotFound ? 'got not_found' : `unexpected: ${out.slice(0, 100)}` };
    },
  },
  // --- 9. list() — table of contents ---
  {
    name: 'list — no args (table of contents)',
    run: () => formatList(handleList(data, {})),
    check: (out: string) => {
      const hasComponents = out.includes('Components:');
      const hasRecipes = out.includes('Recipes:');
      const hasTokens = out.includes('Tokens:');
      return {
        pass: hasComponents && hasRecipes,
        reason: `components=${hasComponents}, recipes=${hasRecipes}, tokens=${hasTokens}`,
      };
    },
  },
  // --- 10. list("components") ---
  {
    name: 'list — "components"',
    run: () => formatList(handleList(data, { what: "components" })),
    check: (out: string) => {
      const hasCount = /^\d+ components/.test(out);
      const hasCategories = out.includes('(') && out.split('\n').length > 5;
      return { pass: hasCount && hasCategories, reason: `count=${hasCount}, categories=${hasCategories}` };
    },
  },
  // --- 11. list("recipes") ---
  {
    name: 'list — "recipes"',
    run: () => formatList(handleList(data, { what: "recipes" })),
    check: (out: string) => {
      const hasRecipes = out.includes('recipes');
      const hasLevels = out.includes('molecule') || out.includes('foundation') || out.includes('organism');
      return { pass: hasRecipes && hasLevels, reason: `recipes=${hasRecipes}, levels=${hasLevels}` };
    },
  },
  // --- 12. list("tokens") ---
  {
    name: 'list — "tokens"',
    run: () => formatList(handleList(data, { what: "tokens" })),
    check: (out: string) => {
      const hasTopics = out.includes('spacing') || out.includes('breakpoints');
      return { pass: hasTopics, reason: hasTopics ? 'has token topics' : 'no topics' };
    },
  },
];

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  console.log("=".repeat(70));
  console.log(`TEST: ${test.name}`);
  console.log("-".repeat(70));
  try {
    const output = test.run();
    const preview = output.length > 500 ? output.slice(0, 500) + "\n... [truncated]" : output;
    console.log("OUTPUT:");
    console.log(preview);
    console.log("-".repeat(70));
    const { pass, reason } = test.check(output);
    if (pass) {
      console.log(`PASS: ${reason}`);
      passCount++;
    } else {
      console.log(`FAIL: ${reason}`);
      failCount++;
    }
  } catch (err: unknown) {
    console.log(`FAIL (exception): ${err instanceof Error ? err.stack : String(err)}`);
    failCount++;
  }
  console.log("");
}

console.log("=".repeat(70));
console.log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${tests.length} total`);
if (failCount > 0) process.exit(1);
