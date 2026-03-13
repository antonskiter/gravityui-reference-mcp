import type { Page, Chunk, ComponentTags } from "../types.js";

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "of", "to", "for",
  "with", "on", "at", "by", "is", "it", "its", "be", "as",
  "are", "was", "were", "that", "this", "from", "up", "how",
  "can", "you", "use", "used", "using", "component", "components",
]);

export function tokenizeAndClean(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_/,.:;()]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

export function expandCompoundTags(tags: string[]): string[] {
  const expanded = new Set(tags);
  for (const tag of tags) {
    if (tag.includes("-")) {
      for (const part of tag.split("-")) {
        if (part.length > 1) expanded.add(part);
      }
    }
  }
  return [...expanded];
}

export const SYNONYM_MAP: Record<string, string[]> = {
  select: ["dropdown", "picker", "combobox", "chooser"],
  checkbox: ["toggle", "check", "tick", "checkmark"],
  date: ["calendar", "datetime", "date-picker", "datepicker"],
  button: ["action", "submit", "trigger", "cta", "click"],
  dialog: ["modal", "popup", "overlay", "window", "lightbox"],
  table: ["grid", "data-table", "spreadsheet", "rows", "columns", "datagrid"],
  tabs: ["tab-bar", "tab-panel", "tabbed"],
  menu: ["context-menu", "dropdown-menu", "navigation-menu"],
  tooltip: ["hint", "tip", "popover-hint"],
  popover: ["popup", "floating", "bubble"],
  drawer: ["sidebar", "side-panel", "slide-out"],
  breadcrumbs: ["breadcrumb", "navigation-path", "trail"],
  pagination: ["paging", "page-navigation", "paginator"],
  slider: ["range", "range-slider", "track"],
  switch: ["toggle", "toggle-switch", "on-off"],
  radio: ["radio-button", "option", "radio-group"],
  label: ["tag", "badge", "chip"],
  avatar: ["profile-image", "user-icon", "user-photo"],
  loader: ["spinner", "loading", "progress-indicator"],
  skeleton: ["placeholder", "shimmer", "loading-skeleton"],
  input: ["text-field", "text-input", "form-field"],
  link: ["anchor", "hyperlink", "url"],
  card: ["tile", "panel", "container"],
  alert: ["notification", "banner", "message"],
  progress: ["progress-bar", "loading-bar"],
  icon: ["svg", "glyph", "symbol"],
  list: ["item-list", "listbox"],
  spin: ["spinner", "loading-spinner"],
  divider: ["separator", "hr", "line"],
  overlay: ["backdrop", "mask", "curtain"],
  accordion: ["collapsible", "expandable", "disclosure"],
  stepper: ["wizard", "step-indicator", "multi-step"],
  navigation: ["nav", "sidebar", "aside"],
  header: ["app-bar", "top-bar", "navbar"],
  footer: ["bottom-bar"],
  sheet: ["bottom-sheet", "action-sheet"],
  pin: ["otp", "verification-code"],
  number: ["numeric", "counter", "increment"],
  clipboard: ["copy", "copy-to-clipboard"],
  user: ["profile", "identity", "account"],
};

const PROP_CAPABILITY_MAP: Record<string, string> = {
  multiple: "multi-select",
  filterable: "filtering",
  disabled: "disableable",
  loading: "loading-state",
  sortable: "sorting",
  selectable: "selectable",
  draggable: "drag-and-drop",
  resizable: "resizable",
  editable: "editable",
  searchable: "searchable",
  clearable: "clearable",
  closable: "closable",
  collapsible: "collapsible",
  expandable: "expandable",
  virtualized: "virtualized",
};

function extractPropNames(content: string): string[] {
  const propNames: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^\|\s*(\w+)\s*\|/);
    if (match && match[1] !== "Name" && match[1] !== "---") {
      propNames.push(match[1]);
    }
  }
  return propNames;
}

export function generateTagsForComponent(page: Page, chunks: Chunk[]): string[] {
  const tags = new Set<string>();

  const nameLower = page.title.toLowerCase();
  tags.add(nameLower);

  if (page.library) {
    tags.add(page.library);
  }

  const nameWords = tokenizeAndClean(page.title);
  for (const word of nameWords) {
    if (SYNONYM_MAP[word]) {
      for (const syn of SYNONYM_MAP[word]) {
        tags.add(syn);
      }
    }
  }

  if (page.description) {
    const descTokens = tokenizeAndClean(page.description);
    for (const token of descTokens) {
      tags.add(token);
      if (SYNONYM_MAP[token]) {
        for (const syn of SYNONYM_MAP[token]) {
          tags.add(syn);
        }
      }
    }
  }

  for (const chunk of chunks) {
    if (chunk.section_title !== page.title) {
      const titleTokens = tokenizeAndClean(chunk.section_title);
      for (const token of titleTokens) {
        tags.add(token);
      }
    }
  }

  const propsChunk = chunks.find(c =>
    ["properties", "props", "api"].includes(c.section_title.toLowerCase())
  );
  if (propsChunk) {
    const propNames = extractPropNames(propsChunk.content);
    for (const prop of propNames) {
      const capability = PROP_CAPABILITY_MAP[prop.toLowerCase()];
      if (capability) {
        tags.add(capability);
      }
    }
  }

  return expandCompoundTags([...tags]);
}

export function generateAllTags(pages: Page[], chunks: Chunk[]): ComponentTags {
  const tags: ComponentTags = {};
  const chunksByPageId = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = chunksByPageId.get(chunk.page_id) ?? [];
    list.push(chunk);
    chunksByPageId.set(chunk.page_id, list);
  }

  for (const page of pages) {
    if (page.page_type !== "component") continue;
    const pageChunks = chunksByPageId.get(page.id) ?? [];
    tags[page.id] = generateTagsForComponent(page, pageChunks);
  }

  return tags;
}
