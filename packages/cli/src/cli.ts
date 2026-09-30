#!/usr/bin/env node
import { runValidate } from "./commands/validate.js";
import { runBuildProjection } from "./commands/build-projection.js";

function parseArgs(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = "true";
    }
  }
  return flags;
}

// CLI-layer convenience default only; the pure domain projection function always
// receives an explicit asOf and never reads the system clock itself.
function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function runValidateCommand(root: string): Promise<number> {
  const result = await runValidate(root);
  for (const d of result.diagnostics) {
    console.log(`${d.code} ${d.path}: ${d.message}`);
  }
  const { topics, artifacts, sessions, evidence } = result.counts;
  console.log(
    `topics=${topics} artifacts=${artifacts} sessions=${sessions} evidence=${evidence} errors=${result.diagnostics.length}`,
  );
  return result.diagnostics.length > 0 ? 1 : 0;
}

async function runBuildProjectionCommand(
  root: string,
  asOf: string,
  outPath: string,
  configPath: string | undefined,
): Promise<number> {
  const result = await runBuildProjection({ root, asOf, outPath, configPath });
  if (!result.ok) {
    for (const d of result.diagnostics) {
      console.log(`${d.code} ${d.path}: ${d.message}`);
    }
    console.log(`errors=${result.diagnostics.length}`);
    return 1;
  }
  const { topics, artifacts, sessions, evidence } = result.counts!;
  console.log(`topics=${topics} artifacts=${artifacts} sessions=${sessions} evidence=${evidence}`);
  console.log(`as_of=${asOf}`);
  console.log(`output=${result.outputPath}`);
  console.log(`checksum=${result.checksum}`);
  return 0;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  const root = flags.root ?? ".";

  if (command === "validate") {
    return runValidateCommand(root);
  }

  if (command === "build-projection") {
    const asOf = flags["as-of"] ?? todayIso();
    const outPath = flags.out ?? "dist/projection.json";
    return runBuildProjectionCommand(root, asOf, outPath, flags.config);
  }

  console.error(`Unknown command: ${command ?? "(none)"}. Expected "validate" or "build-projection".`);
  return 2;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
