import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

export type IssueKind = "missing" | "inconsistent" | "unused" | "extra";
export interface Issue {
  kind: IssueKind;
  locale: string;
  key: string;
  detail: string;
}
export interface ScanOptions {
  localesDir: string;
  sourceDir: string;
  baseLocale?: string;
}
export interface ScanResult {
  baseLocale: string;
  localeCount: number;
  keyCount: number;
  usedCount: number;
  issues: Issue[];
}

type Messages = Map<string, string>;

function flatten(value: unknown, prefix = "", output = new Map<string, string>()): Messages {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix && typeof value === "string") output.set(prefix, value);
    return output;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const next = prefix ? prefix + "." + key : key;
    if (typeof child === "string") output.set(next, child);
    else flatten(child, next, output);
  });
  return output;
}

async function jsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(path));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".json") files.push(path);
  }
  return files;
}

async function loadLocale(directory: string): Promise<Messages> {
  const merged = new Map<string, string>();
  for (const path of await jsonFiles(directory)) {
    const document: unknown = JSON.parse(await readFile(path, "utf8"));
    flatten(document, "", merged);
  }
  return merged;
}

async function localeFiles(root: string): Promise<Map<string, Messages>> {
  const entries = await readdir(root, { withFileTypes: true });
  const locales = new Map<string, Messages>();
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) locales.set(entry.name, await loadLocale(path));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".json") {
      const locale = entry.name.slice(0, -extname(entry.name).length);
      const document: unknown = JSON.parse(await readFile(path, "utf8"));
      locales.set(locale, flatten(document));
    }
  }
  return locales;
}

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist" && !entry.name.startsWith(".")) {
      files.push(...await sourceFiles(path));
    } else if (entry.isFile() && codeExtensions.has(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files;
}

function placeholders(value: string): string[] {
  const found = new Set<string>();
  const expression = /\{\{\s*([\w.-]+)\s*\}\}|\{\s*([\w.-]+)\s*\}|%\{(\w+)\}|%s/g;
  for (const match of value.matchAll(expression)) found.add(match[1] ?? match[2] ?? match[3] ?? "%s");
  return [...found].sort();
}

async function usedKeys(directory: string): Promise<Set<string>> {
  const used = new Set<string>();
  const call = /(?:\b(?:t|translate)\s*\(|\b(?:i18n|intl)\s*\.\s*t\s*\()\s*(['"])([^'"\\]+)\1/g;
  for (const path of await sourceFiles(directory)) {
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(call)) used.add(match[2]);
  }
  return used;
}

export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const locales = await localeFiles(options.localesDir);
  if (!locales.size) throw new Error("Nenhum arquivo JSON de locale foi encontrado.");
  const baseLocale = options.baseLocale ?? locales.keys().next().value;
  if (!baseLocale || !locales.has(baseLocale)) {
    throw new Error("Locale base \"" + String(baseLocale) + "\" não encontrado. Disponíveis: " + [...locales.keys()].join(", "));
  }
  const base = locales.get(baseLocale)!;
  const used = await usedKeys(options.sourceDir);
  const issues: Issue[] = [];

  for (const [locale, messages] of locales) {
    if (locale === baseLocale) continue;
    for (const [key, baseText] of base) {
      const text = messages.get(key);
      if (text === undefined) {
        issues.push({ kind: "missing", locale, key, detail: "Chave ausente no locale " + locale + "." });
      } else if (JSON.stringify(placeholders(baseText)) !== JSON.stringify(placeholders(text))) {
        issues.push({
          kind: "inconsistent",
          locale,
          key,
          detail: "Placeholders diferem: base [" + placeholders(baseText).join(", ") + "], " +
            locale + " [" + placeholders(text).join(", ") + "].",
        });
      }
    }
    for (const key of messages.keys()) {
      if (!base.has(key)) issues.push({ kind: "extra", locale, key, detail: "Chave não existe no locale base." });
    }
  }
  for (const key of base.keys()) {
    if (!used.has(key)) issues.push({ kind: "unused", locale: baseLocale, key, detail: "Nenhuma chamada estática de tradução referencia esta chave." });
  }
  const priority: Record<IssueKind, number> = { missing: 0, inconsistent: 1, extra: 2, unused: 3 };
  issues.sort((a, b) => priority[a.kind] - priority[b.kind] || a.locale.localeCompare(b.locale) || a.key.localeCompare(b.key));
  return { baseLocale, localeCount: locales.size, keyCount: base.size, usedCount: [...base.keys()].filter((key) => used.has(key)).length, issues };
}

