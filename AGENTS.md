# BearTrace agent contract

## Repository role

This repository is the **public BearTrace engine**. It contains schemas, projection code, the encrypted read-only dashboard, examples, and a private-ledger starter template. It must not contain a user's real learning records.

- Never create real records under root `topics/`, `artifacts/`, `sessions/`, or `evidence/`. Those paths are ignored as a final safety net.
- When asked to save real learning material, locate the separate private Ledger worktree first. If it is not available, ask for its path instead of placing the record here.
- Example records belong only under `examples/` and must be synthetic.
- Read [docs/ai-authoring.md](docs/ai-authoring.md) completely before creating or changing a learning record.

## Security invariants

- GitHub Pages receives only the static application and `dashboard.enc.json`.
- Never add plaintext Projection, Ledger Markdown, a passphrase, access token, decrypted payload, or private record identifier to public source, fixtures, Actions logs, or uploaded artifacts.
- Dashboard unlock is local decryption, not server authentication. Do not replace it with a client-side string or hash comparison.
- Do not add a browser write path, GitHub token, or write API. The dashboard remains read-only.
- Deployment workflows with secrets run only from trusted `main`, manual dispatch, or the fixed `repository_dispatch` event. Never use `pull_request_target` to build untrusted code with secrets.

## Change verification

Run these before presenting a code change:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm validate:examples
pnpm build:projection:examples
```

For real Ledger changes, run the engine CLI against that private worktree as documented in `docs/ai-authoring.md`. Prefer a branch and PR; do not commit or push unless the user asks.
