import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDirectories = ["app", "components", "lib", "pages", "src"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const prohibited = [
  ["fetch()", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\s*\(/],
  ["EventSource", /\bEventSource\s*\(/],
  ["sendBeacon", /\bsendBeacon\s*\(/],
  ["axios", /(?:from\s*["']axios["']|require\s*\(\s*["']axios["']\s*\)|\baxios\s*\.)/],
  ["Node HTTP client", /(?:from\s*["']node:https?["']|require\s*\(\s*["'](?:node:)?https?["']\s*\))/],
  ["network socket", /(?:from\s*["']node:(?:net|tls|dgram)["']|require\s*\(\s*["'](?:node:)?(?:net|tls|dgram)["']\s*\))/],
];

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = (await Promise.all(sourceDirectories.map(collect))).flat();
const violations = [];

for (const file of files) {
  const lines = (await readFile(join(root, file), "utf8")).split(/\r?\n/);
  for (const [name, pattern] of prohibited) {
    lines.forEach((line, index) => {
      if (pattern.test(line)) violations.push(`${relative(root, file)}:${index + 1} uses ${name}`);
    });
  }
}

if (violations.length) {
  console.error("Privacy check failed. Outbound-network code was found:\n");
  violations.forEach((violation) => console.error(`- ${violation}`));
  console.error("\nThe app promises browser-local document processing. Review or remove this code before building.");
  process.exit(1);
}

console.log(`Privacy check passed: scanned ${files.length} source files; no outbound-network APIs found.`);
