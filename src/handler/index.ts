import type {
  Skill,
  SkillProvider,
  SkillsHandlerConfig,
  SkillsHandler,
  SkillIndex,
} from "../types.js";
import { isValidSkillName, isValidFilePath } from "../types.js";

const DEFAULT_CACHE_CONTROL = "public, max-age=3600";

/**
 * Creates a skills handler that serves Agent Skills via well-known URIs.
 *
 * @example Next.js App Router: `app/.well-known/skills/[[...path]]/route.ts`
 * ```typescript
 * import { createSkillsHandler, createStaticProvider } from "skills-handler";
 *
 * const handler = createSkillsHandler(
 *   createStaticProvider([
 *     {
 *       name: "git-workflow",
 *       description: "Follow team Git conventions for branching and commits.",
 *       body: "# Git Workflow\n\nCreate feature branches from `main`...",
 *       files: ["SKILL.md"],
 *     },
 *   ])
 * );
 *
 * export { handler as GET };
 * ```
 *
 * This serves:
 * - `GET /.well-known/skills/index.json` - Skills discovery index
 * - `GET /.well-known/skills/{name}/SKILL.md` - Skill instructions
 * - `GET /.well-known/skills/{name}/{file}` - Supporting resources
 */
export function createSkillsHandler(
  provider: SkillProvider,
  config: SkillsHandlerConfig = {}
): SkillsHandler {
  const {
    basePath = "/.well-known/skills",
    verboseLogs = false,
    cacheControl = DEFAULT_CACHE_CONTROL,
    cors = "*",
    onEvent,
  } = config;

  // Normalize base path (remove trailing slash)
  const normalizedBasePath = basePath.replace(/\/$/, "");

  const log = verboseLogs
    ? (...args: unknown[]) => console.log("[skills-handler]", ...args)
    : () => {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function emitEvent(event: Record<string, any> & { type: string; path: string }): void {
    if (onEvent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onEvent({ ...event, timestamp: Date.now() } as any);
    }
  }

  /**
   * Creates response headers with CORS and caching.
   */
  function createHeaders(contentType: string): Headers {
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    });

    if (cors !== false) {
      const origin = Array.isArray(cors) ? cors.join(", ") : cors;
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
    }

    return headers;
  }

  /**
   * Handles OPTIONS requests for CORS preflight.
   */
  function handleOptions(): Response {
    const headers = createHeaders("text/plain");
    headers.set("Content-Length", "0");
    return new Response(null, { status: 204, headers });
  }

  /**
   * Serves the skills index.
   */
  async function serveIndex(requestPath: string): Promise<Response> {
    try {
      const skills = await provider.getSkills();

      const index: SkillIndex = {
        skills: skills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          files: skill.files,
        })),
      };

      log(`Serving index with ${skills.length} skills`);

      emitEvent({
        type: "INDEX_REQUESTED",
        path: requestPath,
        skillCount: skills.length,
      });

      return new Response(JSON.stringify(index, null, 2), {
        status: 200,
        headers: createHeaders("application/json"),
      });
    } catch (error) {
      log("Error serving index:", error);
      emitEvent({
        type: "ERROR",
        path: requestPath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: createHeaders("application/json") }
      );
    }
  }

  /**
   * Serves a skill's SKILL.md file.
   */
  async function serveSkillMd(
    skillName: string,
    requestPath: string
  ): Promise<Response> {
    try {
      const skills = await provider.getSkills();
      const skill = skills.find((s) => s.name === skillName);

      if (!skill) {
        log(`Skill not found: ${skillName}`);
        emitEvent({ type: "NOT_FOUND", path: requestPath, skillName });
        return new Response(
          JSON.stringify({ error: "Skill not found" }),
          { status: 404, headers: createHeaders("application/json") }
        );
      }

      // Reconstruct the SKILL.md file
      const content = reconstructSkillMd(skill);

      log(`Serving SKILL.md for: ${skillName}`);
      emitEvent({
        type: "SKILL_REQUESTED",
        path: requestPath,
        skillName,
      });

      return new Response(content, {
        status: 200,
        headers: createHeaders("text/markdown; charset=utf-8"),
      });
    } catch (error) {
      log(`Error serving SKILL.md for ${skillName}:`, error);
      emitEvent({
        type: "ERROR",
        path: requestPath,
        error: error instanceof Error ? error : new Error(String(error)),
        context: { skillName },
      });
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: createHeaders("application/json") }
      );
    }
  }

  /**
   * Serves a skill's supporting file.
   */
  async function serveSkillFile(
    skillName: string,
    filePath: string,
    requestPath: string
  ): Promise<Response> {
    try {
      const content = await provider.getSkillFile(skillName, filePath);

      if (content === null) {
        log(`File not found: ${skillName}/${filePath}`);
        emitEvent({
          type: "NOT_FOUND",
          path: requestPath,
          skillName,
          filePath,
        });
        return new Response(
          JSON.stringify({ error: "File not found" }),
          { status: 404, headers: createHeaders("application/json") }
        );
      }

      log(`Serving file: ${skillName}/${filePath}`);
      emitEvent({
        type: "FILE_REQUESTED",
        path: requestPath,
        skillName,
        filePath,
      });

      // Determine content type based on file extension
      const contentType = getContentType(filePath);

      return new Response(content, {
        status: 200,
        headers: createHeaders(contentType),
      });
    } catch (error) {
      log(`Error serving file ${skillName}/${filePath}:`, error);
      emitEvent({
        type: "ERROR",
        path: requestPath,
        error: error instanceof Error ? error : new Error(String(error)),
        context: { skillName, filePath },
      });
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: createHeaders("application/json") }
      );
    }
  }

  /**
   * Creates a redirect response using the request's origin.
   */
  function createRedirect(request: Request, path: string): Response {
    const url = new URL(request.url);
    const redirectUrl = new URL(path, url.origin);
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl.toString(),
      },
    });
  }

  /**
   * Main handler function.
   */
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const fullPath = url.pathname;
    const method = request.method.toUpperCase();

    log(`${method} ${fullPath}`);

    // Handle OPTIONS for CORS
    if (method === "OPTIONS") {
      return handleOptions();
    }

    // Only allow GET and HEAD
    if (method !== "GET" && method !== "HEAD") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: createHeaders("application/json") }
      );
    }

    // Extract the path relative to the base path
    // The URL might be:
    //   /.well-known/skills/index.json
    //   /.well-known/skills/git-workflow/SKILL.md
    // We need to extract what comes after the base path
    
    let relativePath: string;
    if (fullPath.startsWith(normalizedBasePath)) {
      relativePath = fullPath.slice(normalizedBasePath.length);
    } else {
      // If basePath doesn't match, assume the entire path is relative
      // This handles cases where Next.js routing already stripped the prefix
      relativePath = fullPath;
    }

    // Ensure relativePath starts with /
    if (!relativePath.startsWith("/")) {
      relativePath = "/" + relativePath;
    }

    // Normalize: remove trailing slash except for root
    if (relativePath.length > 1 && relativePath.endsWith("/")) {
      relativePath = relativePath.slice(0, -1);
    }

    log(`Routing relative path: ${relativePath}`);

    // Route: / or empty (root - redirect to index.json)
    if (relativePath === "/" || relativePath === "") {
      return createRedirect(request, `${normalizedBasePath}/index.json`);
    }

    // Route: /index.json
    if (relativePath === "/index.json") {
      return serveIndex(fullPath);
    }

    // Route: /{skill-name}/SKILL.md
    const skillMdMatch = relativePath.match(/^\/([^/]+)\/SKILL\.md$/);
    if (skillMdMatch) {
      const skillName = skillMdMatch[1];
      if (skillName && isValidSkillName(skillName)) {
        return serveSkillMd(skillName, fullPath);
      } else {
        emitEvent({ type: "NOT_FOUND", path: fullPath, skillName });
        return new Response(
          JSON.stringify({ error: "Invalid skill name" }),
          { status: 400, headers: createHeaders("application/json") }
        );
      }
    }

    // Route: /{skill-name}/{file-path} (other files)
    const skillFileMatch = relativePath.match(/^\/([^/]+)\/(.+)$/);
    if (skillFileMatch) {
      const [, skillName, filePath] = skillFileMatch;
      if (skillName && filePath) {
        if (!isValidSkillName(skillName)) {
          emitEvent({ type: "NOT_FOUND", path: fullPath, skillName });
          return new Response(
            JSON.stringify({ error: "Invalid skill name" }),
            { status: 400, headers: createHeaders("application/json") }
          );
        }
        if (!isValidFilePath(filePath)) {
          emitEvent({ type: "NOT_FOUND", path: fullPath, skillName, filePath });
          return new Response(
            JSON.stringify({ error: "Invalid file path" }),
            { status: 400, headers: createHeaders("application/json") }
          );
        }
        return serveSkillFile(skillName, filePath, fullPath);
      }
    }

    // Route: /{skill-name} (redirect to SKILL.md)
    const skillDirMatch = relativePath.match(/^\/([^/]+)$/);
    if (skillDirMatch) {
      const skillName = skillDirMatch[1];
      if (skillName && isValidSkillName(skillName)) {
        return createRedirect(
          request,
          `${normalizedBasePath}/${skillName}/SKILL.md`
        );
      }
    }

    // Not found
    log(`Path not found: ${fullPath}`);
    emitEvent({ type: "NOT_FOUND", path: fullPath });
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: createHeaders("application/json") }
    );
  };
}

/**
 * Reconstructs a SKILL.md file from a Skill object.
 */
function reconstructSkillMd(skill: Skill): string {
  const frontmatter = `---
name: ${skill.name}
description: ${skill.description}
---`;

  return `${frontmatter}\n\n${skill.body}`;
}

/**
 * Gets the content type for a file based on its extension.
 */
function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    md: "text/markdown; charset=utf-8",
    markdown: "text/markdown; charset=utf-8",
    json: "application/json",
    yaml: "text/yaml; charset=utf-8",
    yml: "text/yaml; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    py: "text/x-python; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    ts: "text/typescript; charset=utf-8",
    sh: "text/x-shellscript; charset=utf-8",
    bash: "text/x-shellscript; charset=utf-8",
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    xml: "application/xml",
  };

  return contentTypes[ext ?? ""] ?? "text/plain; charset=utf-8";
}

export { reconstructSkillMd, getContentType };
