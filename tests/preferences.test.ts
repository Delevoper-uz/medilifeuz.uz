import { describe, expect, it } from "bun:test";
import { readPreference, savedLanguage, savedTheme, writePreference } from "../src/lib/preferences";

describe("saved user choices", () => {
  it("keeps Uzbek Latin selected", () => {
    expect(savedLanguage("uz")).toBe("uz");
  });
  it("keeps Uzbek Cyrillic selected", () => {
    expect(savedLanguage("uz_cyrl")).toBe("uz_cyrl");
  });
  it("keeps dark mode selected", () => {
    expect(savedTheme("dark")).toBe("dark");
  });
  it("keeps light mode selected", () => {
    expect(savedTheme("light")).toBe("light");
  });
  it("does not crash without browser storage", () => {
    expect(readPreference("medilife-lang")).toBeNull();
    expect(() => writePreference("medilife-theme", "dark")).not.toThrow();
  });
});