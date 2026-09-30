import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptUtf8, parseEnvelope } from "./index.js";
import { PASSPHRASE_ENV, runCli } from "./run-cli.js";

const PASSPHRASE = "cli passphrase ✓";
const PLAINTEXT = '{"secret":"cli-plaintext-marker","emoji":"🐻"}';

describe("runCli", () => {
  let dir: string;
  let output: string[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "beartrace-encryption-"));
    output = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function io(env: Record<string, string | undefined>) {
    return { env, stdout: (l: string) => output.push(l), stderr: (l: string) => output.push(l) };
  }

  it("encrypts --in to --out using the passphrase from the environment", async () => {
    const inPath = join(dir, "plain.json");
    const outPath = join(dir, "data.enc.json");
    await writeFile(inPath, PLAINTEXT, "utf8");

    const code = await runCli(["--in", inPath, "--out", outPath], io({ [PASSPHRASE_ENV]: PASSPHRASE }));

    expect(code).toBe(0);
    const text = await readFile(outPath, "utf8");
    expect(text).not.toContain("cli-plaintext-marker");
    expect(await decryptUtf8(parseEnvelope(text), PASSPHRASE)).toBe(PLAINTEXT);
    const logged = output.join("\n");
    expect(logged).not.toContain(PASSPHRASE);
    expect(logged).not.toContain("cli-plaintext-marker");
  });

  it("refuses a passphrase argument and a missing environment passphrase", async () => {
    const inPath = join(dir, "plain.json");
    const outPath = join(dir, "out.json");
    await writeFile(inPath, PLAINTEXT, "utf8");

    expect(
      await runCli(["--in", inPath, "--out", outPath, "--passphrase", "argv-secret"], io({})),
    ).toBe(2);
    expect(await runCli(["--in", inPath, "--out", outPath], io({}))).toBe(2);
    expect(await runCli(["--in", inPath, "--out", outPath], io({ [PASSPHRASE_ENV]: "" }))).toBe(2);
    expect(await runCli(["--in", inPath, "--out", inPath], io({ [PASSPHRASE_ENV]: PASSPHRASE }))).toBe(2);
    expect(output.join("\n")).not.toContain("argv-secret");
    await expect(readFile(outPath)).rejects.toThrow();
  });
});
