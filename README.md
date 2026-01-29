# skills-handler

A framework-agnostic handler for serving [Agent Skills](https://github.com/cloudflare/agent-skills-discovery-rfc) via well-known URIs. Implements the [Agent Skills Discovery specification](https://github.com/cloudflare/agent-skills-discovery-rfc).

**Repository:** [github.com/vercel-labs/skills-handler](https://github.com/vercel-labs/skills-handler)

## Installation

```bash
npm install skills-handler
```

For file-based skill loading:

```bash
npm install skills-handler gray-matter
```

## Quick Start (Next.js)

Create a catch-all route at `app/.well-known/skills/[[...path]]/route.ts`:

```typescript
import { createSkillsHandler, createStaticProvider } from "skills-handler";

const handler = createSkillsHandler(
  createStaticProvider([
    {
      name: "git-workflow",
      description: "Follow team Git conventions for branching and commits.",
      body: `# Git Workflow

Create feature branches from \`main\`:

\`\`\`bash
git checkout -b feature/my-feature main
\`\`\``,
      files: ["SKILL.md"],
    },
  ])
);

export { handler as GET, handler as OPTIONS };
```

Your skills are now available at:

- `GET /.well-known/skills/index.json` - Discovery index
- `GET /.well-known/skills/git-workflow/SKILL.md` - Skill instructions

## File-Based Skills

Load skills from the filesystem instead of defining them in code:

```typescript
// app/.well-known/skills/[[...path]]/route.ts
import { createSkillsHandler, createFileProvider } from "skills-handler";
import path from "path";

const provider = await createFileProvider(path.join(process.cwd(), "skills"));
const handler = createSkillsHandler(provider);

export { handler as GET, handler as OPTIONS };
```

Directory structure:

```
project/
├── app/.well-known/skills/[[...path]]/route.ts
└── skills/
    ├── git-workflow/
    │   └── SKILL.md
    └── pdf-processing/
        ├── SKILL.md
        ├── scripts/
        │   └── extract.py
        └── references/
            └── TABLES.md
```

Each `SKILL.md` file requires YAML frontmatter:

```markdown
---
name: git-workflow
description: Follow team Git conventions for branching and commits.
---

# Git Workflow

Your skill instructions here...
```

## API Reference

### `createSkillsHandler(provider, config?)`

Creates the request handler.

```typescript
const handler = createSkillsHandler(provider, {
  basePath: "/.well-known/skills", // URL base path (default)
  verboseLogs: false,              // Enable debug logging
  cacheControl: "public, max-age=3600", // Cache header
  cors: "*",                       // CORS origin (* | string[] | false)
  onEvent: (event) => {},          // Analytics callback
});
```

### `createStaticProvider(skills, additionalFiles?)`

Creates a provider from skills defined in code.

```typescript
const provider = createStaticProvider([
  {
    name: "my-skill",
    description: "What the skill does and when to use it.",
    body: "# Skill Instructions\n\nMarkdown content...",
    files: ["SKILL.md"],
  },
]);
```

### `createFileProvider(directory)`

Creates a provider that loads skills from the filesystem.

```typescript
const provider = await createFileProvider("./skills");
```

### `createCompositeProvider(providers)`

Merges multiple providers. Later providers override earlier ones for skills with the same name.

```typescript
const provider = createCompositeProvider([
  await createFileProvider("./base-skills"),
  createStaticProvider([overrideSkill]),
]);
```

## CLI

Initialize a skills endpoint in your project:

```bash
npx skills-handler init
```

Create a new skill:

```bash
npx skills-handler create-skill my-skill --description "What it does"
```

Validate skills:

```bash
npx skills-handler validate ./skills
```

## Endpoints

The handler serves these endpoints relative to `basePath`:

| Endpoint | Description |
|----------|-------------|
| `/index.json` | Skills discovery index |
| `/{name}/SKILL.md` | Skill instructions |
| `/{name}/{file}` | Supporting resources |

## Skill Format

Skills follow the [Agent Skills specification](https://github.com/cloudflare/agent-skills-discovery-rfc):

- **name**: 1-64 chars, lowercase alphanumeric and hyphens, no leading/trailing/consecutive hyphens
- **description**: Max 1024 chars, explains what the skill does and when to use it
- **files**: Array of files in the skill directory (must include `SKILL.md`)

## Events

Subscribe to events for analytics:

```typescript
const handler = createSkillsHandler(provider, {
  onEvent: (event) => {
    switch (event.type) {
      case "INDEX_REQUESTED":
        console.log(`Index served: ${event.skillCount} skills`);
        break;
      case "SKILL_REQUESTED":
        console.log(`Skill loaded: ${event.skillName}`);
        break;
      case "FILE_REQUESTED":
        console.log(`File served: ${event.skillName}/${event.filePath}`);
        break;
      case "NOT_FOUND":
        console.log(`404: ${event.path}`);
        break;
      case "ERROR":
        console.error(`Error: ${event.error.message}`);
        break;
    }
  },
});
```

## Progressive Disclosure

Skills support progressive loading to manage context efficiently:

1. **Index metadata** - Name and description loaded at startup (~100 tokens per skill)
2. **Skill instructions** - Full `SKILL.md` loaded when skill activates (<5k tokens recommended)
3. **Supporting resources** - Scripts, references, assets loaded on demand

Reference supporting files with relative links in `SKILL.md`:

```markdown
For advanced usage, see [references/ADVANCED.md](references/ADVANCED.md).

Run `scripts/setup.sh` to configure the environment.
```

## License

MIT
