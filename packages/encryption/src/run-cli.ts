import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { encryptUtf8 } from "./crypto.js";
import { serializeEnvelope } from "./envelope.js";
import { EncryptionError } from "./errors.js";

export const PASSPHRASE_ENV = "BEARTRACE_PASSPHRASE";

const USAGE = `Usage: beartrace-encrypt --in <plaintext-path> --out <envelope-path>

The passphrase is read only from the ${PASSPHRASE_ENV} environment variable.`;

export interface CliIo {
  env: Record<string, string | undefined>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

/** Runs the encrypt CLI and returns a process exit code. Never prints the passphrase or plaintext. */
export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let inPath: string;
  let outPath: string;
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        in: { type: "string" },
        out: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    });
    if (values.help) {
      io.stdout(USAGE);
      return 0;
    }
    if (!values.in || !values.out) {
      io.stderr(`Both --in and --out are required.\n${USAGE}`);
      return 2;
    }
    inPath = resolve(values.in);
    outPath = resolve(values.out);
  } catch {
    // parseArgs errors may echo argument values; keep the message generic.
    io.stderr(`Invalid arguments. Passphrases are not accepted as arguments.\n${USAGE}`);
    return 2;
  }

  if (inPath === outPath) {
    io.stderr("--in and --out must be different files.");
    return 2;
  }

  const passphrase = io.env[PASSPHRASE_ENV];
  if (passphrase === undefined || passphrase.trim().length === 0) {
    io.stderr(`${PASSPHRASE_ENV} must be set to a non-empty passphrase.`);
    return 2;
  }

  let plaintext: string;
  try {
    const bytes = await readFile(inPath);
    plaintext = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    io.stderr(`Could not read --in file as UTF-8: ${inPath}`);
    return 1;
  }

  try {
    const envelope = await encryptUtf8(plaintext, passphrase);
    const tmpPath = `${outPath}.tmp-${process.pid}`;
    await writeFile(tmpPath, serializeEnvelope(envelope), { encoding: "utf8", mode: 0o644 });
    await rename(tmpPath, outPath);
  } catch (error) {
    const reason = error instanceof EncryptionError ? error.message : "unexpected error";
    io.stderr(`Encryption failed: ${reason}`);
    return 1;
  }

  io.stderr(`Wrote encrypted envelope to ${outPath}`);
  return 0;
}
