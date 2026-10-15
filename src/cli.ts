#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { scanProject, type IssueKind } from "./scan.js";

function usage() {
  return [
    "i18n-check — verifique chaves, placeholders e uso de traduções",
    "",
    "Uso: i18n-check --locales ./locales --source ./src --base en [--fail-on any|missing|never]",
    "",
    "Aceita arquivos como locales/en.json ou pastas como locales/en/common.json.",
  ].join("\n");
}

function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") options.help = "true";
    else if (argument.startsWith("--")) {
      const key = argument.slice(2);
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Informe um valor para --" + key + ".");
      options[key] = value;
      index += 1;
    } else throw new Error("Argumento não reconhecido: " + argument);
  }
  return options;
}

export async function run(args = process.argv.slice(2)): Promise<number> {
  try {
    const options = parseArgs(args);
    if (options.help) {
      process.stdout.write(usage() + "\n");
      return 0;
    }
    if (!options.locales || !options.source) throw new Error("As opções --locales e --source são obrigatórias.");
    const failOn = options["fail-on"] ?? "missing";
    if (!["any", "missing", "never"].includes(failOn)) throw new Error("--fail-on aceita any, missing ou never.");
    const result = await scanProject({
      localesDir: resolve(options.locales),
      sourceDir: resolve(options.source),
      baseLocale: options.base,
    });
    process.stdout.write("Base " + result.baseLocale + " · " + result.localeCount + " locales · " +
      result.keyCount + " chaves · " + result.usedCount + " referenciadas\n");
    const counts = new Map<IssueKind, number>();
    result.issues.forEach((issue) => counts.set(issue.kind, (counts.get(issue.kind) ?? 0) + 1));
    for (const issue of result.issues) {
      const label = issue.kind.toUpperCase().padEnd(12);
      process.stdout.write(label + issue.locale + ":" + issue.key + " — " + issue.detail + "\n");
    }
    if (!result.issues.length) process.stdout.write("Nenhum problema encontrado.\n");
    else process.stdout.write([...counts].map(([kind, count]) => kind + ": " + count).join(" · ") + "\n");
    const hasFailure = failOn === "any" ? result.issues.length > 0 :
      failOn === "missing" ? result.issues.some((issue) => issue.kind === "missing") : false;
    return hasFailure ? 1 : 0;
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n\n" + usage() + "\n");
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().then((code) => { process.exitCode = code; });
}

