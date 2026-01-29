/**
 * Skill name validation pattern.
 * - 1-64 characters
 * - Lowercase alphanumeric and hyphens only (a-z, 0-9, -)
 * - Must not start or end with a hyphen
 * - Must not contain consecutive hyphens
 */
export const SKILL_NAME_PATTERN = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;

/**
 * Maximum length for skill description.
 */
export const MAX_DESCRIPTION_LENGTH = 1024;

/**
 * Represents the frontmatter metadata of a SKILL.md file.
 */
export interface SkillFrontmatter {
  /** Skill identifier (1-64 chars, lowercase alphanumeric and hyphens) */
  name: string;
  /** Brief description of the skill and when to use it (max 1024 chars) */
  description: string;
}

/**
 * Represents a skill with its full content.
 */
export interface Skill extends SkillFrontmatter {
  /** The markdown body of the SKILL.md (instructions) */
  body: string;
  /** List of all files in the skill directory, relative to skill root */
  files: string[];
}

/**
 * Skill entry in the discovery index (index.json).
 */
export interface SkillIndexEntry {
  /** Skill identifier */
  name: string;
  /** Brief description */
  description: string;
  /** Array of all files in the skill directory */
  files: string[];
}

/**
 * The discovery index served at /.well-known/skills/index.json
 */
export interface SkillIndex {
  skills: SkillIndexEntry[];
}

/**
 * A skill provider that supplies skill definitions programmatically.
 */
export interface SkillProvider {
  /**
   * Returns all available skills.
   */
  getSkills(): Promise<Skill[]> | Skill[];

  /**
   * Returns the content of a specific file within a skill.
   * @param skillName The skill identifier
   * @param filePath The file path relative to the skill directory
   * @returns The file content as a string, or null if not found
   */
  getSkillFile(
    skillName: string,
    filePath: string
  ): Promise<string | null> | string | null;
}

/**
 * Configuration options for the skills handler.
 */
export interface SkillsHandlerConfig {
  /**
   * Base path for the skills endpoints.
   * Defaults to "/.well-known/skills".
   */
  basePath?: string;

  /**
   * Enable verbose logging.
   * @default false
   */
  verboseLogs?: boolean;

  /**
   * Custom cache control header value.
   * @default "public, max-age=3600"
   */
  cacheControl?: string;

  /**
   * CORS origin configuration.
   * Set to "*" for open access, or specify allowed origins.
   * Set to false to disable CORS headers.
   * @default "*"
   */
  cors?: string | string[] | false;

  /**
   * Callback for events (useful for analytics/telemetry).
   */
  onEvent?: (event: SkillsEvent) => void;
}

/**
 * Event types emitted by the skills handler.
 */
export type SkillsEventType =
  | "INDEX_REQUESTED"
  | "SKILL_REQUESTED"
  | "FILE_REQUESTED"
  | "NOT_FOUND"
  | "ERROR";

/**
 * Base event structure.
 */
export interface SkillsEventBase {
  type: SkillsEventType;
  timestamp: number;
  path: string;
}

/**
 * Index request event.
 */
export interface IndexRequestedEvent extends SkillsEventBase {
  type: "INDEX_REQUESTED";
  skillCount: number;
}

/**
 * Skill request event.
 */
export interface SkillRequestedEvent extends SkillsEventBase {
  type: "SKILL_REQUESTED";
  skillName: string;
}

/**
 * File request event.
 */
export interface FileRequestedEvent extends SkillsEventBase {
  type: "FILE_REQUESTED";
  skillName: string;
  filePath: string;
}

/**
 * Not found event.
 */
export interface NotFoundEvent extends SkillsEventBase {
  type: "NOT_FOUND";
  skillName?: string;
  filePath?: string;
}

/**
 * Error event.
 */
export interface ErrorEvent extends SkillsEventBase {
  type: "ERROR";
  error: Error;
  context?: Record<string, unknown>;
}

/**
 * Union of all event types.
 */
export type SkillsEvent =
  | IndexRequestedEvent
  | SkillRequestedEvent
  | FileRequestedEvent
  | NotFoundEvent
  | ErrorEvent;

/**
 * HTTP handler function signature (Web API compatible).
 */
export type SkillsHandler = (request: Request) => Promise<Response> | Response;

/**
 * Validates a skill name against the specification.
 */
export function isValidSkillName(name: string): boolean {
  return SKILL_NAME_PATTERN.test(name);
}

/**
 * Validates a skill's frontmatter.
 */
export function validateSkillFrontmatter(
  frontmatter: unknown
): frontmatter is SkillFrontmatter {
  if (typeof frontmatter !== "object" || frontmatter === null) {
    return false;
  }

  const fm = frontmatter as Record<string, unknown>;

  if (typeof fm.name !== "string" || !isValidSkillName(fm.name)) {
    return false;
  }

  if (
    typeof fm.description !== "string" ||
    fm.description.length === 0 ||
    fm.description.length > MAX_DESCRIPTION_LENGTH
  ) {
    return false;
  }

  return true;
}

/**
 * Validates a file path from the files array.
 * - Must not be empty
 * - Must not start with /
 * - Must not contain ..
 * - Must use forward slashes
 * - Must contain only printable ASCII (0x20-0x7E), excluding \, ?, #, [, ]
 */
export function isValidFilePath(path: string): boolean {
  if (!path || path.length === 0) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("..")) return false;
  if (path.includes("\\")) return false;

  // Check for invalid characters
  const invalidChars = /[?#\[\]\x00-\x1f\x7f-\xff]/;
  if (invalidChars.test(path)) return false;

  return true;
}
