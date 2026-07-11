import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".next" || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }

  return files;
}

describe("mock company application boundary", () => {
  it("contains no Slate internal, Prisma, or LiteLLM imports", async () => {
    const files = await sourceFiles(path.resolve("mock-company-ai"));
    const forbidden = [
      /from\s+["'][^"']*@\/lib\//,
      /from\s+["'][^"']*lib\/internal-ai/,
      /from\s+["']@prisma\/client["']/,
      /processInternalAiGatewayRequest/,
    ];

    for (const file of files) {
      const contents = await readFile(file, "utf8");
      expect(forbidden.some((pattern) => pattern.test(contents)), file).toBe(false);
    }
  });

  it("keeps the source-app key out of browser-prefixed environment variables", async () => {
    const envExample = await readFile(
      path.resolve("mock-company-ai/.env.example"),
      "utf8",
    );
    expect(envExample).toContain("SLATE_SOURCE_APP_KEY");
    expect(envExample).not.toContain("NEXT_PUBLIC_SLATE_SOURCE_APP_KEY");
  });
});
