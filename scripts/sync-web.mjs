import { cp, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve(process.argv[2] ?? "integration-web");
const pkg = JSON.parse(await readFile(resolve(target, "package.json"), "utf8"));
if (pkg.name !== "web")
  throw new Error("El destino debe ser el repositorio Web.");
for (const path of [
  "src/app/apps/finanzas",
  "src/app/api/finanzas",
  "src/lib/finanzas",
]) {
  await mkdir(resolve(target, path), { recursive: true });
  await cp(path, resolve(target, path), { recursive: true });
}
const ours = JSON.parse(await readFile("package.json", "utf8"));
for (const key of ["fflate", "fast-xml-parser", "pdf2json"])
  pkg.dependencies[key] = ours.dependencies[key];
// Use the patched Next.js release for the new private financial app.
pkg.dependencies.next = ours.dependencies.next;
pkg.devDependencies["eslint-config-next"] = ours.dependencies.next;
await writeFile(
  resolve(target, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);
const head = (await import("node:child_process"))
  .execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })
  .trim();
await writeFile(
  resolve(target, "FINANZAS_SOURCE.md"),
  `# Finanzas\n\nFuente: https://github.com/ruizherrero1/finanzas\n\nRevisión de fuente: [${head}](https://github.com/ruizherrero1/finanzas/commit/${head}).\n\nSe sirve en /apps/finanzas usando las cuentas del hub. Editar en finanzas y ejecutar npm run sync:web -- RUTA_WEB; revisar diff y lockfile. La sincronización solo copia los tres directorios de Finanzas.\n`,
);
console.log(
  "Módulo de Finanzas sincronizado. Ejecuta npm install y npm run build en Web.",
);
