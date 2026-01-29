// app/.well-known/skills/[[...path]]/route.ts
//
// This example uses a static provider to define skills directly in code.
// Place this file at: app/.well-known/skills/[[...path]]/route.ts

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
\`\`\`

Commit messages use conventional commits format:

\`\`\`
feat: add user authentication
fix: resolve null pointer in login
docs: update API reference
\`\`\``,
      files: ["SKILL.md"],
    },
    {
      name: "code-review",
      description: "Review code for bugs, security issues, and best practices.",
      body: `# Code Review

## Checklist

1. Check for security vulnerabilities
2. Verify error handling
3. Review test coverage
4. Check for code duplication

## Severity Levels

- **Critical**: Security issues, data loss risks
- **Major**: Bugs, performance issues  
- **Minor**: Style, naming conventions`,
      files: ["SKILL.md"],
    },
  ])
);

export { handler as GET, handler as OPTIONS };
