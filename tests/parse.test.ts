import { describe, it, expect } from "vitest";
import { parsePage } from "../src/ingest/parse.js";

// Sample 1: Design guide MDX with imports, JSX tags, and real content
const designGuideMDX = `
import { Button } from "@gravity-ui/uikit";
import SomeComponent from "./SomeComponent";

export const meta = { title: "Button Design Guide" };

# Button

<Banner>Use responsibly</Banner>

Buttons are used to trigger actions. They communicate calls to action to the user and allow users to interact with pages in a variety of ways.

## Variants

There are several button variants available.

### Default

The default button variant is used for primary actions.

### Outlined

<ExampleBlock code="...">
  <Button view="outlined">Click me</Button>
</ExampleBlock>

## Sizes

Buttons come in multiple sizes.
`;

// Sample 2: Component README with install instructions/badges
const componentREADME = `
# Select

[![npm version](https://img.shields.io/npm/v/@gravity-ui/uikit)](https://www.npmjs.com/package/@gravity-ui/uikit)

## Installation

\`\`\`bash
npm install @gravity-ui/uikit
\`\`\`

## Usage

The Select component allows users to choose from a list of options.

\`\`\`tsx
import {Select} from '@gravity-ui/uikit';

<Select options={options} value={value} onUpdate={setValue} />
\`\`\`

## Properties

| Name | Description |
|------|-------------|
| options | Array of options |
| value | Selected value |

### Option interface

Each option has a value and content property.
`;

// Sample 3: Content without h1
const noH1Content = `
Some content without a heading.

## Section One

Details here.
`;

describe("parsePage", () => {
  it("strips MDX imports, JSX components, and export statements", () => {
    const result = parsePage(designGuideMDX, "guide", "button");
    expect(result.cleanMarkdown).not.toMatch(/^import /m);
    expect(result.cleanMarkdown).not.toMatch(/^export /m);
    expect(result.cleanMarkdown).not.toMatch(/<Banner>/);
    expect(result.cleanMarkdown).not.toMatch(/<ExampleBlock/);
  });

  it("extracts title from h1", () => {
    const result = parsePage(designGuideMDX, "guide", "button");
    expect(result.title).toBe("Button");
  });

  it("extracts description from first substantive paragraph", () => {
    const result = parsePage(designGuideMDX, "guide", "button");
    expect(result.description).toContain("Buttons are used to trigger actions");
    expect(result.description.length).toBeLessThanOrEqual(83); // ~80 chars with some tolerance
  });

  it("extracts heading hierarchy (h2 and h3)", () => {
    const result = parsePage(designGuideMDX, "guide", "button");
    const h2s = result.headings.filter((h) => h.depth === 2);
    const h3s = result.headings.filter((h) => h.depth === 3);
    expect(h2s.map((h) => h.text)).toContain("Variants");
    expect(h2s.map((h) => h.text)).toContain("Sizes");
    expect(h3s.map((h) => h.text)).toContain("Default");
    expect(h3s.map((h) => h.text)).toContain("Outlined");
  });

  it("falls back to name parameter when no h1 is present", () => {
    const result = parsePage(noH1Content, "guide", "my-guide");
    expect(result.title).toBe("my-guide");
  });

  it("skips install instructions and badges when extracting description", () => {
    const result = parsePage(componentREADME, "component", "Select");
    // Should not pick up badge text or installation instructions
    expect(result.description).not.toMatch(/npm install/i);
    expect(result.description).not.toMatch(/!\[/); // badge markdown
    expect(result.description).toContain("Select component allows users");
  });
});
