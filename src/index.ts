/**
 * skills-handler
 *
 * A framework-agnostic handler for serving Agent Skills via well-known URIs.
 * Implements the Agent Skills Discovery specification (agentskills.io).
 *
 * @example
 * ```typescript
 * // Next.js App Router: app/.well-known/skills/[[...path]]/route.ts
 * import { createSkillsHandler, createStaticProvider } from "skills-handler";
 *
 * const handler = createSkillsHandler(
 *   createStaticProvider([
 *     {
 *       name: "git-workflow",
 *       description: "Follow team Git conventions.",
 *       body: "# Git Workflow\n\nCreate feature branches...",
 *       files: ["SKILL.md"],
 *     },
 *   ])
 * );
 *
 * export { handler as GET };
 * ```
 *
 * @packageDocumentation
 */

// Core handler
export { createSkillsHandler } from "./handler/index.js";
export { reconstructSkillMd, getContentType } from "./handler/index.js";

// Providers
export {
  createStaticProvider,
  createFileProvider,
  createCompositeProvider,
} from "./lib/providers.js";

// Types
export type {
  Skill,
  SkillFrontmatter,
  SkillIndex,
  SkillIndexEntry,
  SkillProvider,
  SkillsHandler,
  SkillsHandlerConfig,
  SkillsEvent,
  SkillsEventType,
  SkillsEventBase,
  IndexRequestedEvent,
  SkillRequestedEvent,
  FileRequestedEvent,
  NotFoundEvent,
  ErrorEvent,
} from "./types.js";

// Validation utilities
export {
  isValidSkillName,
  isValidFilePath,
  validateSkillFrontmatter,
  SKILL_NAME_PATTERN,
  MAX_DESCRIPTION_LENGTH,
} from "./types.js";
