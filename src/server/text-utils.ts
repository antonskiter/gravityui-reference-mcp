export function codeBlock(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/** Indent all lines of multi-line text. Empty lines stay empty. */
export function indent(text: string, prefix = "   "): string {
  return text.split("\n").map(line => line ? prefix + line : "").join("\n");
}
