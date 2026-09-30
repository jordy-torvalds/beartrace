#!/usr/bin/env node
import { runCli } from "./run-cli.js";

const exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
});
process.exitCode = exitCode;
