// app/.well-known/skills/[[...path]]/route.ts
//
// This example uses a file-based provider to load skills from the filesystem.
// Place this file at: app/.well-known/skills/[[...path]]/route.ts
//
// Directory structure:
// project/
// ├── app/.well-known/skills/[[...path]]/route.ts  (this file)
// └── skills/
//     ├── git-workflow/
//     │   └── SKILL.md
//     └── code-review/
//         ├── SKILL.md
//         └── references/
//             └── CHECKLIST.md

import { createSkillsHandler, createFileProvider } from "skills-handler";
import path from "path";

// Note: createFileProvider is async, so we use top-level await
const provider = await createFileProvider(path.join(process.cwd(), "skills"));

const handler = createSkillsHandler(provider, {
  verboseLogs: process.env.NODE_ENV === "development",
});

export { handler as GET, handler as OPTIONS };
