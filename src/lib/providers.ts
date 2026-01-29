import type { Skill, SkillProvider } from "../types.js";
import {
  isValidSkillName,
  isValidFilePath,
  validateSkillFrontmatter,
} from "../types.js";

/**
 * Creates a static skill provider from an array of skills.
 * Useful for defining skills directly in code.
 *
 * @example
 * ```typescript
 * const provider = createStaticProvider([
 *   {
 *     name: "git-workflow",
 *     description: "Follow team Git conventions for branching and commits.",
 *     body: "# Git Workflow\n\nCreate feature branches from `main`...",
 *     files: ["SKILL.md"],
 *   },
 * ]);
 * ```
 */
export function createStaticProvider(
  skills: Skill[],
  additionalFiles?: Record<string, Record<string, string>>
): SkillProvider {
  // Validate skills on creation
  for (const skill of skills) {
    if (!isValidSkillName(skill.name)) {
      throw new Error(`Invalid skill name: ${skill.name}`);
    }
    if (
      !skill.description ||
      typeof skill.description !== "string" ||
      skill.description.length > 1024
    ) {
      throw new Error(`Invalid skill description for: ${skill.name}`);
    }
    if (!skill.files.includes("SKILL.md")) {
      throw new Error(`Skill ${skill.name} must include SKILL.md in files array`);
    }
    for (const file of skill.files) {
      if (!isValidFilePath(file)) {
        throw new Error(`Invalid file path in skill ${skill.name}: ${file}`);
      }
    }
  }

  const skillMap = new Map(skills.map((s) => [s.name, s]));

  return {
    getSkills() {
      return skills;
    },

    getSkillFile(skillName: string, filePath: string) {
      const skill = skillMap.get(skillName);
      if (!skill) return null;

      // SKILL.md is handled by the handler, but we can also return it here
      if (filePath === "SKILL.md") {
        return null; // Let handler reconstruct it
      }

      // Check additional files
      const skillFiles = additionalFiles?.[skillName];
      if (skillFiles && filePath in skillFiles) {
        return skillFiles[filePath] ?? null;
      }

      return null;
    },
  };
}

/**
 * Creates a skill provider that loads skills from the filesystem.
 * Each skill is a directory containing SKILL.md and optional resources.
 *
 * @param skillsDir - Path to the directory containing skill directories
 *
 * @example
 * ```typescript
 * // Given directory structure:
 * // skills/
 * //   git-workflow/
 * //     SKILL.md
 * //   pdf-processing/
 * //     SKILL.md
 * //     scripts/extract.py
 *
 * const provider = await createFileProvider("./skills");
 * ```
 */
export async function createFileProvider(
  skillsDir: string
): Promise<SkillProvider> {
  // We need to dynamically import fs and path for Node.js
  const fs = await import("fs/promises");
  const path = await import("path");

  // Try to import gray-matter for parsing frontmatter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matter: (content: string) => { data: Record<string, unknown>; content: string };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    matter = require("gray-matter");
  } catch {
    throw new Error(
      "gray-matter is required for file-based providers. Install it with: npm install gray-matter"
    );
  }

  const resolvedDir = path.resolve(skillsDir);

  // Cache for skills
  let skillsCache: Skill[] | null = null;
  let lastScan = 0;
  const CACHE_TTL = 60000; // 1 minute

  async function scanSkills(): Promise<Skill[]> {
    const now = Date.now();
    if (skillsCache && now - lastScan < CACHE_TTL) {
      return skillsCache;
    }

    const skills: Skill[] = [];

    try {
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!isValidSkillName(entry.name)) continue;

        const skillDir = path.join(resolvedDir, entry.name);
        const skillMdPath = path.join(skillDir, "SKILL.md");

        try {
          const content = await fs.readFile(skillMdPath, "utf-8");
          const parsed = matter(content);

          if (!validateSkillFrontmatter(parsed.data)) {
            console.warn(
              `[skills-handler] Invalid frontmatter in ${skillMdPath}, skipping`
            );
            continue;
          }

          // Collect all files in the skill directory
          const files = await collectFiles(skillDir, "");

          skills.push({
            name: parsed.data.name,
            description: parsed.data.description,
            body: parsed.content.trim(),
            files,
          });
        } catch (err) {
          // Skip directories without SKILL.md
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            console.warn(
              `[skills-handler] Error reading ${skillMdPath}:`,
              err
            );
          }
        }
      }
    } catch (err) {
      console.error(`[skills-handler] Error scanning skills directory:`, err);
    }

    skillsCache = skills;
    lastScan = now;
    return skills;
  }

  async function collectFiles(
    dir: string,
    prefix: string
  ): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subFiles = await collectFiles(
          path.join(dir, entry.name),
          relativePath
        );
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }

    return files;
  }

  return {
    async getSkills() {
      return scanSkills();
    },

    async getSkillFile(skillName: string, filePath: string) {
      if (!isValidSkillName(skillName)) return null;
      if (!isValidFilePath(filePath)) return null;

      // Don't serve SKILL.md through this method (handler reconstructs it)
      if (filePath === "SKILL.md") return null;

      const fullPath = path.join(resolvedDir, skillName, filePath);

      // Security: ensure path is within skill directory
      const normalizedPath = path.normalize(fullPath);
      const skillDirPath = path.join(resolvedDir, skillName);
      if (!normalizedPath.startsWith(skillDirPath)) {
        return null;
      }

      try {
        return await fs.readFile(fullPath, "utf-8");
      } catch {
        return null;
      }
    },
  };
}

/**
 * Creates a composite provider that merges skills from multiple providers.
 * Later providers take precedence for skills with the same name.
 *
 * @example
 * ```typescript
 * const provider = createCompositeProvider([
 *   await createFileProvider("./base-skills"),
 *   createStaticProvider([customSkill]),
 * ]);
 * ```
 */
export function createCompositeProvider(
  providers: SkillProvider[]
): SkillProvider {
  return {
    async getSkills() {
      const skillMap = new Map<string, Skill>();

      for (const provider of providers) {
        const skills = await provider.getSkills();
        for (const skill of skills) {
          skillMap.set(skill.name, skill);
        }
      }

      return Array.from(skillMap.values());
    },

    async getSkillFile(skillName: string, filePath: string) {
      // Try providers in reverse order (last takes precedence)
      for (let i = providers.length - 1; i >= 0; i--) {
        const content = await providers[i]!.getSkillFile(skillName, filePath);
        if (content !== null) {
          return content;
        }
      }
      return null;
    },
  };
}
