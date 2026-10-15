// Use the already installed compiler for Node's native test runner; no test dependencies.
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const source = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const candidate = specifier.startsWith("@/") ? new URL(specifier.slice(2), source) :
      specifier.startsWith(".") && context.parentURL ? new URL(specifier, context.parentURL) : null;
    if (candidate) {
      for (const suffix of ["", ".ts", ".tsx"]) {
        const path = fileURLToPath(candidate) + suffix;
        if (existsSync(path) && /\.tsx?$/.test(path)) return next(pathToFileURL(path).href, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!/\.tsx?$/.test(url)) return next(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: fileURLToPath(url), compilerOptions: { module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
});
