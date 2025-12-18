import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) {
  console.error("Missing `SUPABASE_PROJECT_REF`. Example: SUPABASE_PROJECT_REF=<ref> npm run supabase:types");
  process.exit(2);
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, "..", "..");
const outputPath = path.join(rootDir, "src", "integrations", "supabase", "types.ts");
const tmpPath = `${outputPath}.tmp-${process.pid}`;

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"] });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

const types = await run("npx", [
  "-y",
  "supabase@latest",
  "gen",
  "types",
  "typescript",
  "--project-id",
  projectRef,
  "--schema",
  "public",
]);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(tmpPath, types.endsWith("\n") ? types : `${types}\n`, "utf8");

try {
  await copyFile(tmpPath, outputPath);
} finally {
  await rm(tmpPath, { force: true });
}

console.log(`Wrote Supabase types to ${outputPath}`);
