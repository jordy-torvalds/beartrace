# Local QA report

## Result

Public engine, private Ledger contract, encrypted Projection, and GitHub Pages workflow passed local acceptance. Actual repositories, credentials, Pages settings, and hosted deployment remain external/pending in `external-verification.md`.

## Scenario matrix

| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-01 | Valid example lifecycle | 5 Topics, 3 Artifacts, 8 Sessions, 7 Evidence validate | Pass |
| QA-02 | Malformed/impossible date | CLI rejects invalid data | Pass |
| QA-03 | Duplicate stable ID | CLI rejects duplicates with repository-relative diagnostics | Pass |
| QA-04 | Session-only activity | Capability does not advance | Pass |
| QA-05 | Evidence on rejected Session | Repository validation fails | Pass |
| QA-06 | Failed/partial recall | History remains; only retested capabilities refresh | Pass |
| QA-07 | Projection reproducibility | Repeated builds are byte-identical | Pass |
| QA-08 | Projection privacy | Artifact 보고서 본문만 암호화 대상 Projection에 포함되고 Session/Evidence 본문, AI rationale, absolute path는 제외됨 | Pass |
| QA-09 | Unicode encryption round trip | AES-GCM envelope decrypts to the exact Projection | Pass |
| QA-10 | Wrong passphrase | Decryption fails with a generic error | Pass |
| QA-11 | Ciphertext tampering | Modified ciphertext, IV, salt, or authenticated metadata is rejected | Pass |
| QA-12 | Envelope validation | Unknown/missing fields and unsafe iteration values are rejected | Pass |
| QA-13 | Public artifact leak scan | Topic titles, test passphrase, and plaintext `dashboard.json` are absent | Pass |
| QA-14 | GitHub project base path | `/beartrace/` HTML, assets, and encrypted data path resolve | Pass |
| QA-15 | Dashboard write boundary | No browser write API or GitHub token path exists | Pass |
| QA-16 | AI authoring boundary | Public AGENTS blocks real records; private starter routes every record type | Pass |
| QA-17 | Workflow syntax | Public CI/deploy and private notify YAML parse successfully | Pass |

## Verification evidence

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` — 36 tests passed
- `pnpm validate:examples` — 5/3/8/7 records, zero errors
- `pnpm build:projection:examples` — deterministic checksum `b165e8c05ba8fda5db208b871358a477f9ff9ee6d83b9fa7ab3236cd20f73359`
- Encrypted HTTP smoke test: correct passphrase produced 5 Topics; wrong passphrase returned `DECRYPTION_FAILED`
- Production build smoke test under `/beartrace/`: asset paths and `dashboard.enc.json` resolved
- Ciphertext scans found no example Topic title, passphrase, or plaintext Projection file
- Ruby YAML parsing accepted all three workflow files

## Residual risks

- The isolated browser surface was unavailable, so UI interaction was verified through production compilation, HTTP routing, cryptographic integration tests, and direct decrypt/reject smoke tests rather than screenshot automation.
- GitHub Pages is public. A strong passphrase is required because the ciphertext can be attacked offline without rate limiting.
- Hosted workflow permissions, token scopes, automatic repository dispatch, and the final Pages URL cannot be proven until the user creates/configures the two GitHub repositories.
