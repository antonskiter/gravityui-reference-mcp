/**
 * Smoke test for all MCP tools.
 * Imports from compiled dist/ because src/ingest/tags.ts does not exist.
 * Run: npx tsx src/server/smoke-test.ts
 */

const ROOT = new URL("../../dist/", import.meta.url).pathname;

const { loadData } = await import(`${ROOT}server/loader.js`);
const { handleListComponents, formatListComponents } = await import(`${ROOT}server/tools/list-components.js`);
const { handleGetComponent, formatGetComponent } = await import(`${ROOT}server/tools/get-component.js`);
const { handleSuggestComponent, formatSuggestComponent } = await import(`${ROOT}server/tools/suggest-component.js`);
const { handleSearchDocs, formatSearchDocs } = await import(`${ROOT}server/tools/search-docs.js`);
const { handleGetDesignTokens, formatGetDesignTokens } = await import(`${ROOT}server/tools/get-design-tokens.js`);

const data = loadData();
console.log(`Loaded: ${data.pages.length} pages, ${data.chunks.length} chunks, ${data.componentDefs.length} components\n`);

interface TestCase {
  name: string;
  run: () => string;
  check: (output: string) => { pass: boolean; reason: string };
}

const tests: TestCase[] = [
  // --- 1. list_components no args ---
  {
    name: "list_components — no args",
    run: () => formatListComponents(handleListComponents(data, {})),
    check: (out: string) => {
      const hasCategories = out.includes("(") && out.split("\n").length > 5;
      const hasCount = /^\d+ components/.test(out);
      // Check for duplicate component names within groups
      const lines = out.split("\n");
      const dupes: string[] = [];
      let currentGroup = "";
      const namesInGroup: string[] = [];
      for (const line of lines) {
        if (/^\S/.test(line) && line.includes("(")) {
          if (namesInGroup.length > 0) {
            const seen = new Set<string>();
            for (const n of namesInGroup) {
              if (seen.has(n)) dupes.push(`${n} in ${currentGroup}`);
              seen.add(n);
            }
          }
          currentGroup = line;
          namesInGroup.length = 0;
        } else if (line.startsWith("  ")) {
          namesInGroup.push(line.trim().split(" ")[0]);
        }
      }
      const dupeNote = dupes.length > 0 ? ` DUPLICATES: ${dupes.join("; ")}` : "";
      return { pass: hasCategories && hasCount, reason: (hasCount ? "has count" : "no count") + ", " + (hasCategories ? "has categories" : "no categories") + dupeNote };
    },
  },
  // --- 2. list_components library=uikit ---
  {
    name: 'list_components — library="uikit"',
    run: () => formatListComponents(handleListComponents(data, { library: "uikit" })),
    check: (out: string) => {
      const hasComponents = out.split("\n").length > 3;
      return { pass: hasComponents, reason: hasComponents ? "filtered to uikit" : "too few lines" };
    },
  },
  // --- 3. get_component Button ---
  {
    name: 'get_component — name="Button"',
    run: () => {
      const raw = handleGetComponent(data, { name: "Button" });
      const formatted = formatGetComponent(raw, "compact");
      // Also note which library it resolved to
      const lib = raw.component?.library ?? "NONE";
      const propCount = raw.component?.props?.length ?? 0;
      return `[resolves to: ${lib}, props: ${propCount}]\n${formatted}`;
    },
    check: (out: string) => {
      const hasImport = out.includes("import");
      const propsNotEmpty = /\w+\??: \w/.test(out);
      return { pass: hasImport && propsNotEmpty, reason: `import=${hasImport}, propsNotEmpty=${propsNotEmpty}` };
    },
  },
  // --- 4. get_component Select full ---
  {
    name: 'get_component — name="Select", detail="full"',
    run: () => {
      const raw = handleGetComponent(data, { name: "Select" });
      const formatted = formatGetComponent(raw, "full");
      const propCount = raw.component?.props?.length ?? 0;
      return `[props: ${propCount}]\n${formatted}`;
    },
    check: (out: string) => {
      const hasProps = /\w+\??: /.test(out);
      const hasInterface = out.includes("Props {");
      return { pass: hasProps && hasInterface, reason: `hasProps=${hasProps}, hasInterface=${hasInterface}` };
    },
  },
  // --- 5. get_component NonExistent ---
  {
    name: 'get_component — name="NonExistent"',
    run: () => formatGetComponent(handleGetComponent(data, { name: "NonExistent" }), "compact"),
    check: (out: string) => {
      const isError = out.includes("not found");
      const hasSuggestions = out.includes("Similar:");
      return { pass: isError, reason: isError ? `got error. hasSuggestions=${hasSuggestions}. Full: ${out}` : `unexpected: ${out.slice(0, 200)}` };
    },
  },
  // --- 6. suggest_component ---
  {
    name: 'suggest_component — use_case="dropdown with search"',
    run: () => formatSuggestComponent(handleSuggestComponent(data, { use_case: "dropdown with search" })),
    check: (out: string) => {
      const hasSuggestions = /\d\.\s/.test(out);
      return { pass: hasSuggestions, reason: hasSuggestions ? "got suggestions" : "no numbered suggestions" };
    },
  },
  // --- 7. search_docs "theming dark mode" ---
  {
    name: 'search_docs — query="theming dark mode"',
    run: () => formatSearchDocs(handleSearchDocs(data, { query: "theming dark mode" })),
    check: (out: string) => {
      const hasResults = out.includes("Found") && !out.includes("Found 0");
      return { pass: hasResults, reason: hasResults ? "got results" : "no results found" };
    },
  },
  // --- 8. search_docs "button size" ---
  {
    name: 'search_docs — query="button size"',
    run: () => formatSearchDocs(handleSearchDocs(data, { query: "button size" })),
    check: (out: string) => {
      const hasResults = out.includes("Found") && !out.includes("Found 0");
      return { pass: hasResults, reason: hasResults ? "got results" : "no results found" };
    },
  },
  // --- 9. get_design_tokens all ---
  {
    name: "get_design_tokens — no args (all topics)",
    run: () => formatGetDesignTokens(handleGetDesignTokens(data, {})),
    check: (out: string) => {
      const hasSpacing = out.includes("Spacing");
      const hasBreakpoints = out.includes("Breakpoints");
      const hasSizes = out.includes("Component sizes");
      const hasColors = out.includes("Semantic colors");
      const nonEmpty = out.trim().length > 20;
      // Check breakpoint ordering
      const bpSection = out.split("Breakpoints")[1]?.split("Usage:")[0] ?? "";
      const bpLines = bpSection.split("\n").filter(l => l.trim().length > 0).map(l => l.trim());
      const bpOrder = bpLines.map(l => l.split(":")[0].trim());
      return {
        pass: nonEmpty,
        reason: `nonEmpty=${nonEmpty} (${out.length} chars), spacing=${hasSpacing}, breakpoints=${hasBreakpoints}, sizes=${hasSizes}, colors=${hasColors}, breakpointOrder=[${bpOrder.join(",")}]`
      };
    },
  },
  // --- 10. get_design_tokens colors ---
  {
    name: 'get_design_tokens — topic="colors"',
    run: () => formatGetDesignTokens(handleGetDesignTokens(data, { topic: "colors" })),
    check: (out: string) => {
      const hasColorData = out.trim().length > 10;
      // Check if it ONLY has colors (no spacing/breakpoints leaking in)
      const hasSpacingLeak = out.includes("Spacing");
      return {
        pass: hasColorData,
        reason: hasColorData
          ? `has color data (${out.length} chars), spacingLeak=${hasSpacingLeak}`
          : `empty or minimal output (${out.length} chars)`
      };
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
