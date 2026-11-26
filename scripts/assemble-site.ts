import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderPublishedHtml } from "../src/lib/publish-site.ts";

const outDir = process.argv[2] || "_site";
const html = await renderPublishedHtml();
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "index.html"), html);
for (const file of ["favicon.ico", "favicon.png", "apple-touch-icon.png"]) {
  await copyFile(path.join("content", file), path.join(outDir, file));
}
await cp(path.join("public", "guides"), path.join(outDir, "guides"), { recursive: true });
await copyFile(path.join("public", "atlas.css"), path.join(outDir, "atlas.css"));
await writeFile(path.join(outDir, ".nojekyll"), "");
