import { describe, it, expect } from "vitest";
import {
  isValidSkillName,
  isValidFilePath,
  validateSkillFrontmatter,
  SKILL_NAME_PATTERN,
} from "../src/types";

describe("isValidSkillName", () => {
  it("accepts valid names", () => {
    expect(isValidSkillName("git-workflow")).toBe(true);
    expect(isValidSkillName("a")).toBe(true);
    expect(isValidSkillName("my-skill-123")).toBe(true);
    expect(isValidSkillName("a".repeat(64))).toBe(true);
  });

  it("rejects names starting with hyphen", () => {
    expect(isValidSkillName("-git")).toBe(false);
  });

  it("rejects names ending with hyphen", () => {
    expect(isValidSkillName("git-")).toBe(false);
  });

  it("rejects consecutive hyphens", () => {
    expect(isValidSkillName("git--workflow")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidSkillName("Git-Workflow")).toBe(false);
  });

  it("rejects underscores", () => {
    expect(isValidSkillName("git_workflow")).toBe(false);
  });

  it("rejects names longer than 64 chars", () => {
    expect(isValidSkillName("a".repeat(65))).toBe(false);
  });

  it("rejects empty names", () => {
    expect(isValidSkillName("")).toBe(false);
  });
});

describe("isValidFilePath", () => {
  it("accepts valid paths", () => {
    expect(isValidFilePath("SKILL.md")).toBe(true);
    expect(isValidFilePath("scripts/extract.py")).toBe(true);
    expect(isValidFilePath("references/deep/nested/file.md")).toBe(true);
  });

  it("rejects paths starting with /", () => {
    expect(isValidFilePath("/SKILL.md")).toBe(false);
  });

  it("rejects paths with ..", () => {
    expect(isValidFilePath("../secret.md")).toBe(false);
    expect(isValidFilePath("scripts/../secret.md")).toBe(false);
  });

  it("rejects backslashes", () => {
    expect(isValidFilePath("scripts\\file.py")).toBe(false);
  });

  it("rejects paths with query params", () => {
    expect(isValidFilePath("file.md?param=value")).toBe(false);
  });

  it("rejects paths with hash", () => {
    expect(isValidFilePath("file.md#section")).toBe(false);
  });

  it("rejects empty paths", () => {
    expect(isValidFilePath("")).toBe(false);
  });
});

describe("validateSkillFrontmatter", () => {
  it("accepts valid frontmatter", () => {
    expect(
      validateSkillFrontmatter({
        name: "git-workflow",
        description: "A valid description",
      })
    ).toBe(true);
  });

  it("rejects missing name", () => {
    expect(
      validateSkillFrontmatter({
        description: "A description",
      })
    ).toBe(false);
  });

  it("rejects missing description", () => {
    expect(
      validateSkillFrontmatter({
        name: "git-workflow",
      })
    ).toBe(false);
  });

  it("rejects invalid name format", () => {
    expect(
      validateSkillFrontmatter({
        name: "Invalid_Name",
        description: "A description",
      })
    ).toBe(false);
  });

  it("rejects empty description", () => {
    expect(
      validateSkillFrontmatter({
        name: "git-workflow",
        description: "",
      })
    ).toBe(false);
  });

  it("rejects description over 1024 chars", () => {
    expect(
      validateSkillFrontmatter({
        name: "git-workflow",
        description: "x".repeat(1025),
      })
    ).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateSkillFrontmatter(null)).toBe(false);
    expect(validateSkillFrontmatter(undefined)).toBe(false);
    expect(validateSkillFrontmatter("string")).toBe(false);
  });
});

describe("SKILL_NAME_PATTERN", () => {
  it("matches the isValidSkillName function behavior", () => {
    const testCases = [
      "git-workflow",
      "a",
      "my-skill-123",
      "-git",
      "git-",
      "git--workflow",
      "Git-Workflow",
    ];

    for (const name of testCases) {
      expect(SKILL_NAME_PATTERN.test(name)).toBe(isValidSkillName(name));
    }
  });
});
