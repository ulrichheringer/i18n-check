import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanProject } from "./scan.js";

let temporary: string;

async function fixture() {
  temporary = await mkdtemp(join(tmpdir(), "i18n-check-"));
  const locales = join(temporary, "locales");
  const source = join(temporary, "src");
  await mkdir(join(locales, "en"), { recursive: true });
  await mkdir(join(locales, "pt-BR"), { recursive: true });
  await mkdir(source);
  await writeFile(join(locales, "en", "common.json"), JSON.stringify({
    greeting: "Hello, {{name}}", unused: "Unused", total: "Total: {count}",
  }));
  await writeFile(join(locales, "pt-BR", "common.json"), JSON.stringify({
    greeting: "Olá, {{user}}", extra: "Extra",
  }));
  await writeFile(join(source, "app.tsx"), 't("greeting"); i18n.t("total");');
  return { localesDir: locales, sourceDir: source, baseLocale: "en" };
}

afterEach(async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

describe("scanProject", () => {
  it("finds missing, inconsistent, unused, and extra keys in nested locale files", async () => {
    const result = await scanProject(await fixture());
    expect(result.keyCount).toBe(3);
    expect(result.usedCount).toBe(2);
    expect(result.issues.map((issue) => issue.kind)).toEqual(["missing", "missing", "inconsistent", "extra", "unused"]);
    expect(result.issues.find((issue) => issue.kind === "inconsistent")?.key).toBe("greeting");
  });

  it("accepts flat locale JSON and does not mark referenced keys as unused", async () => {
    temporary = await mkdtemp(join(tmpdir(), "i18n-flat-"));
    const localesDir = join(temporary, "locales");
    const sourceDir = join(temporary, "src");
    await mkdir(localesDir);
    await mkdir(sourceDir);
    await writeFile(join(localesDir, "en.json"), JSON.stringify({ ok: "Okay" }));
    await writeFile(join(sourceDir, "main.js"), 'translate("ok");');
    const result = await scanProject({ localesDir, sourceDir, baseLocale: "en" });
    expect(result.issues).toEqual([]);
  });
});

