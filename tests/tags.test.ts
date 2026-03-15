import { describe, it, expect } from "vitest";
import { levenshtein, tokenizeAndClean } from "../src/server/tools/suggest-component.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("button", "button")).toBe(0);
  });

  it("returns correct distance for similar strings", () => {
    expect(levenshtein("button", "buton")).toBe(1);
    expect(levenshtein("select", "selct")).toBe(1);
  });

  it("returns string length for empty comparison", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("tokenizeAndClean", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenizeAndClean("Date Range Selection")).toEqual(["date", "range", "selection"]);
  });

  it("removes stop words", () => {
    const result = tokenizeAndClean("a component for the table");
    expect(result).not.toContain("a");
    expect(result).not.toContain("for");
    expect(result).not.toContain("the");
    expect(result).toContain("table");
  });

  it("removes single-character tokens", () => {
    expect(tokenizeAndClean("a b table")).toEqual(["table"]);
  });

  it("preserves hyphenated terms like date-picker", () => {
    const result = tokenizeAndClean("date-picker component");
    expect(result).toContain("date-picker");
  });
});
