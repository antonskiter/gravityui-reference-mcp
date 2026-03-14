export function codeBlock(lang: string, code: string): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

export function bulletList(items: string[]): string {
  return items.map(i => `- ${i}`).join("\n");
}
