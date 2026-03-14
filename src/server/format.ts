import { remark } from "remark";
import stripMarkdown from "strip-markdown";

const stripProcessor = remark().use(stripMarkdown, { keep: ["code"] });

/**
 * Sanitizes content for LLM consumption:
 * 1. Converts markdown tables to compact text (compactTable)
 * 2. Strips all markdown formatting except code blocks (strip-markdown)
 */
export function sanitize(input: string): string {
  const compacted = compactTable(input);
  const stripped = String(stripProcessor.processSync(compacted));
  return postClean(stripped).trim();
}

/**
 * Post-processing cleanup for remark artifacts:
 * - Unescape backslash-escaped characters (e.g. \-- → --)
 * - Remove truncated/broken image refs (e.g. ![Corner…)
 * - Remove HTML comment remnants
 * - Collapse 3+ consecutive blank lines to 2
 */
function postClean(input: string): string {
  return input
    .replace(/\\([^\\])/g, "$1")          // unescape \-- \* etc.
    .replace(/!\[[^\]]*(?:\](?:\([^)]*\))?)?…?/g, "") // broken image refs
    .replace(/<!--[\s\S]*?-->/g, "")       // HTML comments
    .replace(/\n{3,}/g, "\n\n");           // collapse blank lines
}

export function codeBlock(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/**
 * Strips backtick wrapping from a table cell value.
 * e.g. `boolean` → boolean, `"m"` → "m"
 * Multiple backtick-wrapped tokens (e.g. `"s"` `"m"`) are each unwrapped.
 */
function stripBackticks(value: string): string {
  return value.replace(/`([^`]*)`/g, "$1").trim();
}

const PROPS_HEADERS = new Set(["name", "description", "type", "default"]);

function isPropsTable(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase());
  return PROPS_HEADERS.has(lower[0]) && lower.length >= 2;
}

function formatPropsRow(headers: string[], cells: string[]): string {
  const lower = headers.map(h => h.toLowerCase());
  const idx = (key: string) => lower.indexOf(key);

  const nameIdx = idx("name");
  const typeIdx = idx("type");
  const defaultIdx = idx("default");
  const descIdx = idx("description");

  const name = nameIdx >= 0 ? stripBackticks(cells[nameIdx] ?? "") : "";
  const type = typeIdx >= 0 ? stripBackticks(cells[typeIdx] ?? "") : "";
  const def = defaultIdx >= 0 ? stripBackticks(cells[defaultIdx] ?? "") : "";
  const desc = descIdx >= 0 ? stripBackticks(cells[descIdx] ?? "") : "";

  let line = name;
  if (type) line += `: ${type}`;
  if (def) line += ` = ${def}`;
  if (desc) line += ` — ${desc}`;
  return line;
}

function formatGenericRow(headers: string[], cells: string[]): string {
  const first = stripBackticks(cells[0] ?? "");
  const rest = cells.slice(1).map(c => stripBackticks(c));
  return `${first}: ${rest.join(", ")}`;
}

/**
 * Converts markdown table blocks in a string to compact text.
 * Non-table content is left untouched.
 */
export function compactTable(input: string): string {
  const lines = input.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect start of a markdown table block (line starting with |)
    if (line.trimStart().startsWith("|")) {
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }

      // Parse table: first line = header, second = separator, rest = data rows
      const parseRow = (row: string): string[] =>
        row
          .split("|")
          .slice(1, -1)
          .map(cell => cell.trim());

      if (tableLines.length < 2) {
        // Not a real table, pass through
        result.push(...tableLines);
        continue;
      }

      const headers = parseRow(tableLines[0]);
      // tableLines[1] is the separator row — skip it
      const dataRows = tableLines.slice(2).map(parseRow);

      const propsMode = isPropsTable(headers);
      for (const cells of dataRows) {
        if (cells.every(c => c === "")) continue; // skip empty rows
        const formatted = propsMode
          ? formatPropsRow(headers, cells)
          : formatGenericRow(headers, cells);
        result.push(formatted);
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}