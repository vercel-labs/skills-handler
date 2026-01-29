/* eslint-disable @typescript-eslint/no-explicit-any */
import { program } from "commander";
import chalk from "chalk";
import * as fs from "fs/promises";
import * as path from "path";

interface InitOptions {
  dir: string;
  skillsDir: string;
  static: boolean;
}

interface CreateSkillOptions {
  dir: string;
  description?: string;
}

const PACKAGE_VERSION = "0.1.0";

program
  .name("skills-handler")
  .description("CLI for setting up Agent Skills endpoints")
  .version(PACKAGE_VERSION);

program
  .command("init")
  .description("Initialize skills endpoint in a Next.js project")
  .option(
    "-d, --dir <directory>",
    "Target directory for the route",
    "app/.well-known/skills/[[...path]]"
  )
  .option(
    "-s, --skills-dir <directory>",
    "Directory containing skill files",
    "skills"
  )
  .option("--static", "Use static provider instead of file-based", false)
  .action(async (options: InitOptions) => {
    console.log(chalk.blue("Setting up Agent Skills endpoint...\n"));

    const routeDir = options.dir;
    const skillsDir = options.skillsDir;
    const useStatic = options.static;

    try {
      // Create the route directory
      await fs.mkdir(routeDir, { recursive: true });
      console.log(chalk.green(`✓ Created ${routeDir}`));

      // Create route.ts
      const routeContent = useStatic
        ? getStaticRouteTemplate()
        : getFileRouteTemplate(skillsDir);

      const routePath = path.join(routeDir, "route.ts");
      await fs.writeFile(routePath, routeContent);
      console.log(chalk.green(`✓ Created ${routePath}`));

      // Create skills directory if using file provider
      if (!useStatic) {
        await fs.mkdir(skillsDir, { recursive: true });
        console.log(chalk.green(`✓ Created ${skillsDir}/`));

        // Create an example skill
        const exampleSkillDir = path.join(skillsDir, "example-skill");
        await fs.mkdir(exampleSkillDir, { recursive: true });

        const exampleSkillMd = `---
name: example-skill
description: An example skill to demonstrate the skills-handler setup.
---

# Example Skill

This is an example skill. Replace this content with your actual skill instructions.

## Usage

Describe how and when this skill should be used.

## Examples

Provide examples of the skill in action.
`;

        await fs.writeFile(
          path.join(exampleSkillDir, "SKILL.md"),
          exampleSkillMd
        );
        console.log(chalk.green(`✓ Created example skill at ${exampleSkillDir}/SKILL.md`));
      }

      console.log(chalk.blue("\nSetup complete!\n"));
      console.log("Your skills will be available at:");
      console.log(chalk.cyan("  GET /.well-known/skills/index.json"));
      console.log(chalk.cyan("  GET /.well-known/skills/{skill-name}/SKILL.md\n"));

      if (!useStatic) {
        console.log("Add skills by creating directories in", chalk.yellow(skillsDir));
        console.log("Each skill directory should contain a SKILL.md file.\n");
      }

      // Check for required dependencies
      console.log(chalk.blue("Make sure you have the required dependencies:\n"));
      console.log(chalk.gray("  npm install skills-handler"));
      if (!useStatic) {
        console.log(chalk.gray("  npm install gray-matter"));
      }
      console.log();
    } catch (error) {
      console.error(chalk.red("Error setting up skills endpoint:"), error);
      process.exit(1);
    }
  });

program
  .command("create-skill <name>")
  .description("Create a new skill directory")
  .option("-d, --dir <directory>", "Skills directory", "skills")
  .option("--description <text>", "Skill description")
  .action(async (name: string, options: CreateSkillOptions) => {
    const skillsDir = options.dir;
    const description = options.description || `Description for ${name} skill.`;

    // Validate skill name
    const SKILL_NAME_PATTERN = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;
    if (!SKILL_NAME_PATTERN.test(name)) {
      console.error(
        chalk.red(
          "Invalid skill name. Must be 1-64 lowercase alphanumeric characters or hyphens."
        )
      );
      process.exit(1);
    }

    const skillDir = path.join(skillsDir, name);

    try {
      // Check if skill already exists
      try {
        await fs.access(skillDir);
        console.error(chalk.red(`Skill "${name}" already exists at ${skillDir}`));
        process.exit(1);
      } catch {
        // Directory doesn't exist, which is what we want
      }

      // Create skill directory
      await fs.mkdir(skillDir, { recursive: true });

      // Create SKILL.md
      const skillMd = `---
name: ${name}
description: ${description}
---

# ${name.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}

## Overview

Describe what this skill does and when to use it.

## Instructions

Provide detailed instructions for the AI agent.

## Examples

\`\`\`
Example usage or code here
\`\`\`
`;

      await fs.writeFile(path.join(skillDir, "SKILL.md"), skillMd);
      console.log(chalk.green(`✓ Created skill "${name}" at ${skillDir}/SKILL.md`));
    } catch (error) {
      console.error(chalk.red("Error creating skill:"), error);
      process.exit(1);
    }
  });

program
  .command("validate [directory]")
  .description("Validate skills in a directory")
  .action(async (directory = "skills") => {
    console.log(chalk.blue(`Validating skills in ${directory}...\n`));

    const SKILL_NAME_PATTERN = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      let validCount = 0;
      let invalidCount = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(directory, entry.name);
        const skillMdPath = path.join(skillDir, "SKILL.md");

        // Check name format
        if (!SKILL_NAME_PATTERN.test(entry.name)) {
          console.log(chalk.red(`✗ ${entry.name}: Invalid skill name format`));
          invalidCount++;
          continue;
        }

        // Check for SKILL.md
        try {
          await fs.access(skillMdPath);
        } catch {
          console.log(chalk.red(`✗ ${entry.name}: Missing SKILL.md`));
          invalidCount++;
          continue;
        }

        // Parse and validate SKILL.md
        try {
          const content = await fs.readFile(skillMdPath, "utf-8");

          // Simple frontmatter parsing (regex-based for CLI)
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) {
            console.log(
              chalk.red(`✗ ${entry.name}: Missing or invalid frontmatter`)
            );
            invalidCount++;
            continue;
          }

          const frontmatter = frontmatterMatch[1];
          const nameMatch = frontmatter?.match(/^name:\s*(.+)$/m);
          const descMatch = frontmatter?.match(/^description:\s*(.+)$/m);

          if (!nameMatch || !descMatch) {
            console.log(
              chalk.red(
                `✗ ${entry.name}: Frontmatter missing name or description`
              )
            );
            invalidCount++;
            continue;
          }

          const fmName = nameMatch[1]?.trim();
          const fmDesc = descMatch[1]?.trim();

          if (fmName !== entry.name) {
            console.log(
              chalk.yellow(
                `⚠ ${entry.name}: Frontmatter name "${fmName}" doesn't match directory name`
              )
            );
          }

          if (!fmDesc || fmDesc.length === 0) {
            console.log(chalk.red(`✗ ${entry.name}: Description is empty`));
            invalidCount++;
            continue;
          }

          if (fmDesc.length > 1024) {
            console.log(
              chalk.red(`✗ ${entry.name}: Description exceeds 1024 characters`)
            );
            invalidCount++;
            continue;
          }

          console.log(chalk.green(`✓ ${entry.name}: Valid`));
          validCount++;
        } catch (error) {
          console.log(chalk.red(`✗ ${entry.name}: Error reading SKILL.md`));
          invalidCount++;
        }
      }

      console.log(
        chalk.blue(
          `\nValidation complete: ${validCount} valid, ${invalidCount} invalid`
        )
      );

      if (invalidCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red("Error validating skills:"), error);
      process.exit(1);
    }
  });

program.parse();

function getStaticRouteTemplate(): string {
  return `import { createSkillsHandler, createStaticProvider } from "skills-handler";

const handler = createSkillsHandler(
  createStaticProvider([
    {
      name: "example-skill",
      description: "An example skill to demonstrate the setup.",
      body: \`# Example Skill

This is an example skill. Replace this with your actual skill content.

## Usage

Describe how to use this skill.
\`,
      files: ["SKILL.md"],
    },
    // Add more skills here
  ])
);

export { handler as GET, handler as OPTIONS };
`;
}

function getFileRouteTemplate(skillsDir: string): string {
  return `import { createSkillsHandler, createFileProvider } from "skills-handler";
import path from "path";

// Create a file-based provider that loads skills from the ${skillsDir}/ directory
const provider = await createFileProvider(
  path.join(process.cwd(), "${skillsDir}")
);

const handler = createSkillsHandler(provider);

export { handler as GET, handler as OPTIONS };
`;
}
