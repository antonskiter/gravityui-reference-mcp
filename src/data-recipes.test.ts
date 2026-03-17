import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { RecipeDefSchema } from "./schemas.js";

const recipesPath = resolve(import.meta.dirname, "../data/recipes.json");
const raw = JSON.parse(readFileSync(recipesPath, "utf-8"));
const parsed = z.array(RecipeDefSchema).parse(raw);

const EXPECTED_IDS = [
  "confirmation-dialog",
  "data-table",
  "file-upload",
  "page-states",
  "theming-dark-mode",
];

const EXPECTED_LEVELS: Record<string, string> = {
  "confirmation-dialog": "molecule",
  "data-table": "organism",
  "file-upload": "organism",
  "page-states": "molecule",
  "theming-dark-mode": "foundation",
};

describe("data/recipes.json conformance", () => {
  it("parses with z.array(RecipeDefSchema)", () => {
    // parsing already happened above — if we get here, it succeeded
    expect(parsed).toBeDefined();
  });

  it("contains exactly 5 recipes", () => {
    expect(parsed).toHaveLength(5);
  });

  it("has the expected IDs in alphabetical order", () => {
    const ids = parsed.map((r) => r.id);
    expect(ids).toEqual(EXPECTED_IDS);
  });

  it("has the correct level for each recipe", () => {
    for (const recipe of parsed) {
      expect(recipe.level).toBe(EXPECTED_LEVELS[recipe.id]);
    }
  });

  it("has no @-prefixed library IDs in component items", () => {
    for (const recipe of parsed) {
      for (const section of recipe.sections) {
        if (section.type === "components") {
          for (const item of section.items) {
            expect(item.library).not.toMatch(
              /^@/,
              `Recipe "${recipe.id}" component "${item.name}" has @-prefixed library: "${item.library}"`,
            );
          }
        }
      }
    }
  });

  it("has no standalone flow sections (flow is inside structure only)", () => {
    for (const recipe of parsed) {
      for (const section of recipe.sections) {
        // The schema uses discriminatedUnion on "type", so a standalone
        // {type: "flow"} would fail parsing. But let's also verify at
        // the raw JSON level that no section has type "flow".
        const rawRecipe = raw.find(
          (r: { id: string }) => r.id === recipe.id,
        );
        for (const rawSection of rawRecipe.sections) {
          expect(rawSection.type).not.toBe("flow");
        }
      }
    }
  });

  it("every recipe has a decision section", () => {
    for (const recipe of parsed) {
      const hasDecision = recipe.sections.some((s) => s.type === "decision");
      expect(hasDecision).toBe(true);
    }
  });

  it("every recipe has at least one example section", () => {
    for (const recipe of parsed) {
      const exampleCount = recipe.sections.filter(
        (s) => s.type === "example",
      ).length;
      expect(exampleCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("has no setup.packages field (packages is top-level only)", () => {
    for (const recipe of parsed) {
      for (const section of recipe.sections) {
        if (section.type === "setup") {
          expect((section as { packages?: unknown }).packages).toBeUndefined();
        }
      }
    }
  });

  it("structure sections use flow not data_flow", () => {
    for (const recipe of parsed) {
      const rawRecipe = raw.find(
        (r: { id: string }) => r.id === recipe.id,
      );
      for (const rawSection of rawRecipe.sections) {
        if (rawSection.type === "structure") {
          expect(rawSection).not.toHaveProperty("data_flow");
        }
      }
    }
  });

  it("custom_parts items have {name, description, approach} shape", () => {
    for (const recipe of parsed) {
      for (const section of recipe.sections) {
        if (section.type === "custom_parts") {
          for (const item of section.items) {
            expect(item).toHaveProperty("name");
            expect(item).toHaveProperty("description");
            expect(item).toHaveProperty("approach");
          }
        }
      }
    }
  });

  it("component items have no key_props field", () => {
    for (const recipe of parsed) {
      for (const section of recipe.sections) {
        if (section.type === "components") {
          for (const item of section.items) {
            expect(item).not.toHaveProperty("key_props");
          }
        }
      }
    }
  });
});
