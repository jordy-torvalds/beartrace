# BearTrace

BearTrace는 읽은 자료의 수가 아니라 설명·전이·적용·회상으로 검증된 학습 능력을 관측하는 개인 Learning Ledger입니다.

현재 배포 구조는 **public engine + private ledger + encrypted GitHub Pages**입니다. GitHub Pages는 공개되어 있지만 학습 Projection은 브라우저에서만 복호화됩니다.

```text
Private beartrace-ledger                 Public beartrace
Topic / Artifact / Session / Evidence   Engine / Dashboard / Examples
                │                                 │
                └──── GitHub Actions build ───────┘
                                  │
                                  ▼
                       dashboard.enc.json
                                  │
                                  ▼
                         GitHub Pages (public)
                                  │
                     passphrase로 브라우저 복호화
```

비밀번호 문자열이나 해시를 프런트엔드에서 비교하지 않습니다. 빌드 시 GitHub Secret의 passphrase로 Projection을 `PBKDF2-SHA-256 + AES-256-GCM` 암호화하고, 같은 passphrase를 입력했을 때만 복호화됩니다.

## 현재 저장소 구조

```text
apps/dashboard/                 읽기 전용 React/Vite Dashboard
packages/domain/                Markdown schema와 Projection 규칙
packages/cli/                   Ledger 검증·Projection CLI
packages/encryption/            브라우저/Node 공용 암복호화와 빌드 CLI
examples/                       공개 가능한 합성 예제 Ledger
templates/                      레코드 템플릿
templates/ledger-repository/    private Ledger 저장소 starter
docs/ai-authoring.md            AI 자료 분류·작성 계약
.github/workflows/validate.yml  공개 엔진 CI
.github/workflows/deploy.yml    private Ledger 조회·암호화·Pages 배포
```

이 public 저장소의 루트 `topics/`, `artifacts/`, `sessions/`, `evidence/`는 의도적으로 Git에서 무시합니다. 실제 자료는 별도 private 저장소에만 둡니다.

## 로컬 검증

Node.js 20 이상과 pnpm 10이 필요합니다.

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm validate:examples
pnpm build:projection:examples
```

암호화된 예제 대시보드를 실행하려면 현재 셸에 테스트용 passphrase를 설정한 뒤 다음을 실행합니다.

```bash
export BEARTRACE_PASSPHRASE="local-demo-passphrase"
pnpm prepare:dashboard:examples
pnpm dashboard:dev
```

브라우저에도 같은 `local-demo-passphrase`를 입력합니다. 실제 배포 passphrase를 명령행이나 문서에 적지 마십시오.

## 자료를 추가하는 흐름

- 직접 작성: private Ledger를 Obsidian/에디터로 수정하고 push합니다.
- AI 작성: [AI authoring contract](docs/ai-authoring.md)에 따라 올바른 레코드와 경로를 선택하고 branch/PR로 제안합니다.
- 자동 배포: private Ledger의 push가 public engine에 rebuild 이벤트를 보내고, Projection을 암호화해 GitHub Pages에 게시합니다.
- 읽기: Dashboard는 `dashboard.enc.json`만 내려받아 현재 탭에서 복호화하며 쓰기 기능이나 GitHub token을 가지지 않습니다. Artifact Markdown 본문은 암호화된 Projection에 포함되어 `보고서` 화면에서 검색하고 읽을 수 있습니다.

설정 절차와 secret 권한은 [운영 문서](docs/operations.md)를 따릅니다.

## 보안 한계

GitHub Pages의 암호문은 누구나 다운로드할 수 있으므로 서버 측 로그인과 같지 않습니다. 공격자는 횟수 제한 없이 오프라인으로 암호를 추측할 수 있습니다. 따라서 다른 서비스에서 사용하지 않는 길고 무작위인 passphrase를 사용해야 합니다. 원본 Ledger의 private repository 분리는 필수입니다.
