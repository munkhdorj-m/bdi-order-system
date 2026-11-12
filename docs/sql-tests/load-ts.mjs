// Loads the website's own TypeScript modules into a test, so the tests run
// the code that ships rather than a copy of it.
//
//   const { writeOrder } = loadTs("lib/orders/write.ts");
//
// "@/…" imports resolve inside web/src. The two things a test can't have
// are swapped: "server-only" (a build-time guard) and the Supabase admin
// client, which becomes whatever the test put in globalThis.__bdiAdmin
// (see fake-supabase.mjs).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DOCS } from "./harness.mjs";

export const WEB = path.resolve(DOCS, "..", "web");
const SRC = path.join(WEB, "src");

const STUBS = {
  "server-only": {},
  "@/lib/supabase/admin": { createAdminClient: () => globalThis.__bdiAdmin },
};

let ts;
function typescript() {
  if (!ts) {
    try {
      ts = createRequire(path.join(WEB, "package.json"))("typescript");
    } catch {
      throw new Error("TypeScript not found — run `npm install` in web/ first.");
    }
  }
  return ts;
}

function resolveFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot find module file for ${base}`);
}

/**
 * Load a module by path relative to web/src (or an absolute path — used to
 * try a deliberately broken copy against the same checks). Each call gets
 * fresh module instances, so tests don't share state.
 */
export function loadTs(file, cache = new Map()) {
  const full = resolveFile(path.isAbsolute(file) ? file : path.join(SRC, file));
  if (cache.has(full)) return cache.get(full).exports;
  const t = typescript();
  const js = t.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: { module: t.ModuleKind.CommonJS, target: t.ScriptTarget.ES2022, jsx: t.JsxEmit.ReactJSX },
    fileName: full,
  }).outputText;
  const mod = { exports: {} };
  cache.set(full, mod);
  const nodeRequire = createRequire(full);
  const localRequire = (spec) => {
    if (spec in STUBS) return STUBS[spec];
    if (spec.startsWith("@/")) return loadTs(path.join(SRC, spec.slice(2)), cache);
    if (spec.startsWith(".")) return loadTs(path.resolve(path.dirname(full), spec), cache);
    return nodeRequire(spec);
  };
  new Function("exports", "module", "require", js)(mod.exports, mod, localRequire);
  return mod.exports;
}
