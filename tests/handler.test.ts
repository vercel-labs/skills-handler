import { describe, it, expect, vi } from "vitest";
import { createSkillsHandler, createStaticProvider } from "../src/index";

const testSkills = [
  {
    name: "git-workflow",
    description: "Follow team Git conventions for branching and commits.",
    body: "# Git Workflow\n\nCreate feature branches from `main`.",
    files: ["SKILL.md"],
  },
  {
    name: "code-review",
    description: "Review code for bugs, security issues, and best practices.",
    body: "# Code Review\n\nCheck for security vulnerabilities.",
    files: ["SKILL.md", "references/CHECKLIST.md"],
  },
];

const additionalFiles = {
  "code-review": {
    "references/CHECKLIST.md": "# Checklist\n\n- [ ] Security\n- [ ] Performance",
  },
};

describe("createSkillsHandler", () => {
  const provider = createStaticProvider(testSkills, additionalFiles);
  const handler = createSkillsHandler(provider);

  describe("GET /index.json", () => {
    it("returns skills index", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/index.json"
      );
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body.skills).toHaveLength(2);
      expect(body.skills[0]).toEqual({
        name: "git-workflow",
        description: "Follow team Git conventions for branching and commits.",
        files: ["SKILL.md"],
      });
    });

    it("includes CORS headers", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/index.json"
      );
      const response = await handler(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("includes cache headers", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/index.json"
      );
      const response = await handler(request);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=3600"
      );
    });
  });

  describe("GET /{skill}/SKILL.md", () => {
    it("returns skill markdown with frontmatter", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/git-workflow/SKILL.md"
      );
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8"
      );

      const body = await response.text();
      expect(body).toContain("---");
      expect(body).toContain("name: git-workflow");
      expect(body).toContain("description: Follow team Git conventions");
      expect(body).toContain("# Git Workflow");
    });

    it("returns 404 for unknown skill", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/unknown-skill/SKILL.md"
      );
      const response = await handler(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Skill not found");
    });

    it("returns 400 for invalid skill name", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/Invalid_Name/SKILL.md"
      );
      const response = await handler(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid skill name");
    });
  });

  describe("GET /{skill}/{file}", () => {
    it("returns supporting files", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/code-review/references/CHECKLIST.md"
      );
      const response = await handler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8"
      );

      const body = await response.text();
      expect(body).toContain("# Checklist");
    });

    it("returns 404 for unknown file", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/code-review/unknown.md"
      );
      const response = await handler(request);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /{skill}", () => {
    it("redirects to SKILL.md", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/git-workflow"
      );
      const response = await handler(request);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "http://localhost/.well-known/skills/git-workflow/SKILL.md"
      );
    });
  });

  describe("OPTIONS", () => {
    it("handles CORS preflight", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/index.json",
        { method: "OPTIONS" }
      );
      const response = await handler(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, HEAD, OPTIONS"
      );
    });
  });

  describe("unsupported methods", () => {
    it("returns 405 for POST", async () => {
      const request = new Request(
        "http://localhost/.well-known/skills/index.json",
        { method: "POST" }
      );
      const response = await handler(request);

      expect(response.status).toBe(405);
    });
  });
});

describe("createSkillsHandler with config", () => {
  it("respects custom basePath", async () => {
    const provider = createStaticProvider(testSkills);
    const handler = createSkillsHandler(provider, {
      basePath: "/api/skills",
    });

    const request = new Request("http://localhost/api/skills/index.json");
    const response = await handler(request);

    expect(response.status).toBe(200);
  });

  it("respects custom cacheControl", async () => {
    const provider = createStaticProvider(testSkills);
    const handler = createSkillsHandler(provider, {
      cacheControl: "no-cache",
    });

    const request = new Request(
      "http://localhost/.well-known/skills/index.json"
    );
    const response = await handler(request);

    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("can disable CORS", async () => {
    const provider = createStaticProvider(testSkills);
    const handler = createSkillsHandler(provider, {
      cors: false,
    });

    const request = new Request(
      "http://localhost/.well-known/skills/index.json"
    );
    const response = await handler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("emits events", async () => {
    const events: unknown[] = [];
    const provider = createStaticProvider(testSkills);
    const handler = createSkillsHandler(provider, {
      onEvent: (event) => events.push(event),
    });

    await handler(
      new Request("http://localhost/.well-known/skills/index.json")
    );
    await handler(
      new Request("http://localhost/.well-known/skills/git-workflow/SKILL.md")
    );

    expect(events).toHaveLength(2);
    expect((events[0] as { type: string }).type).toBe("INDEX_REQUESTED");
    expect((events[1] as { type: string }).type).toBe("SKILL_REQUESTED");
  });
});

describe("createStaticProvider", () => {
  it("validates skill names", () => {
    expect(() =>
      createStaticProvider([
        {
          name: "Invalid_Name",
          description: "Test",
          body: "Test",
          files: ["SKILL.md"],
        },
      ])
    ).toThrow("Invalid skill name");
  });

  it("requires SKILL.md in files", () => {
    expect(() =>
      createStaticProvider([
        {
          name: "test-skill",
          description: "Test",
          body: "Test",
          files: ["other.md"],
        },
      ])
    ).toThrow("must include SKILL.md");
  });

  it("validates description length", () => {
    expect(() =>
      createStaticProvider([
        {
          name: "test-skill",
          description: "x".repeat(1025),
          body: "Test",
          files: ["SKILL.md"],
        },
      ])
    ).toThrow("Invalid skill description");
  });
});
