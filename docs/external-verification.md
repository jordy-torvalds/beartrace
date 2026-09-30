# External verification record

로컬 테스트로 증명할 수 없는 GitHub 설정과 실제 배포 결과를 기록합니다. 증빙이 없으면 `Pending`을 유지합니다.

| Acceptance item | Status | Evidence |
|---|---|---|
| Public engine repository created | Pending | |
| Private Ledger repository created | Pending | |
| Public `main` ruleset + required `validate` check | Pending | |
| Ledger read token limited to private Ledger `Contents: read` | Pending | |
| Dispatch token limited to public engine `Contents: write` | Pending | |
| GitHub Pages source set to GitHub Actions | Pending | |
| Encrypted deploy workflow completed | Pending | |
| Published site contains no plaintext `dashboard.json` | Pending | |
| Wrong passphrase rejected | Pending | |
| Correct passphrase displays expected Projection | Pending | |
| Private Ledger push triggers automatic rebuild | Pending | |
| Mobile and desktop unlock/display verified | Pending | |

각 항목에는 설정 화면 캡처 링크, workflow run URL, commit SHA 또는 재현 명령을 남깁니다. Secret 값이나 passphrase 자체는 절대 기록하지 않습니다.
