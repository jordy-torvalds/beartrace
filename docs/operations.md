# GitHub Pages encrypted deployment operations

로컬 구현은 외부 시스템을 변경하지 않습니다. 아래 설정은 사용자가 GitHub에서 직접 수행하거나, 외부 변경 직전에 명시적으로 승인한 뒤 자동화해야 합니다.

## 1. 두 저장소를 준비합니다

### Public engine repository

현재 `beartrace` 코드를 public repository의 `main`에 둡니다. 이 저장소에는 개인 Topic, Artifact, Session, Evidence를 넣지 않습니다.

### Private ledger repository

새 private repository를 만들고 `templates/ledger-repository/`의 내용을 저장소 루트에 복사합니다. 실제 학습 자료는 이 저장소에만 둡니다.

```text
topics/
artifacts/
sessions/
evidence/
sources/
config/beartrace.config.json
AGENTS.md
.github/workflows/notify-dashboard.yml
```

## 2. Public engine의 Actions 설정

Settings → Secrets and variables → Actions에서 설정합니다.

| 종류 | 이름 | 값과 최소 권한 |
|---|---|---|
| Variable | `BEARTRACE_LEDGER_REPOSITORY` | `owner/private-ledger-repository` |
| Secret | `BEARTRACE_LEDGER_READ_TOKEN` | private Ledger 하나에만 접근하는 fine-grained token, `Contents: read` |
| Secret | `BEARTRACE_PASSPHRASE` | 다른 곳에서 사용하지 않는 길고 무작위인 dashboard passphrase |

passphrase는 대화, Markdown, workflow input 또는 명령행 인자로 전달하지 않습니다. GitHub Secret 화면에 직접 입력합니다.

Settings → Pages → Build and deployment의 Source를 **GitHub Actions**로 선택합니다. `deploy.yml`은 공식 Pages artifact와 deploy actions를 사용합니다.

`main`에는 branch protection/ruleset을 적용하고 `validate` check를 required로 둡니다. Secret을 사용하는 deploy workflow는 PR에서 실행되지 않으며 `pull_request_target`을 추가하지 않습니다.

## 3. Private ledger의 자동 알림 설정

Private Ledger의 Settings → Secrets and variables → Actions에서 설정합니다.

| 종류 | 이름 | 값과 최소 권한 |
|---|---|---|
| Variable | `BEARTRACE_ENGINE_REPOSITORY` | `owner/public-beartrace` |
| Secret | `BEARTRACE_DEPLOY_TOKEN` | public engine 하나에만 접근하는 fine-grained token, `Contents: write` |

GitHub의 repository dispatch endpoint가 fine-grained token에 `Contents: write`를 요구하기 때문에 이 권한이 필요합니다. 이 token은 private Ledger를 읽거나 Pages를 배포할 권한이 없어야 합니다.

`main`에 학습 자료나 원본 첨부 파일이 push되면 `notify-dashboard.yml`이 `ledger-updated` 이벤트를 보냅니다. Public engine의 `deploy.yml`이 private Ledger를 checkout하고 다음을 수행합니다.

```text
validate → projection → dashboard build → encryption → Pages artifact → deploy
```

Private validation과 Projection 명령의 상세 출력은 public Actions 로그에 노출하지 않습니다. 실패하면 private workspace에서 같은 검증을 실행해 진단합니다.

Artifact의 `attachments`에는 Ledger 내부의 상대 경로와 `media_type`을 선언할 수 있습니다. 현재 `text/html`, `text/markdown`, `application/pdf`를 지원하며, 배포 시 원본 파일은 평문 Pages 파일로 복사하지 않고 암호화 Projection에 포함합니다. 잠금 해제 후 대시보드의 `HTML 원본` 탭에서 HTML을 sandbox 미리보기로 표시하고, `첨부 파일` 탭에서 세 파일을 열거나 내려받을 수 있습니다. 첨부 경로는 Ledger 루트 밖으로 나갈 수 없습니다.

## 4. 최초 배포 검증

1. Public engine의 Actions에서 `Deploy encrypted dashboard to GitHub Pages`를 수동 실행합니다.
2. build와 deploy job이 모두 성공했는지 확인합니다.
3. Pages URL에서 잠금 화면이 보이는지 확인합니다.
4. 잘못된 passphrase로 열리지 않는지 확인합니다.
5. 올바른 passphrase로 현재 Projection이 보이는지 확인합니다.
6. 브라우저 Network에서 내려받은 파일이 `dashboard.enc.json`이고 Topic 제목, Artifact 본문, Evidence metadata가 평문으로 검색되지 않는지 확인합니다.
7. private Ledger에 합성 Topic 하나를 추가해 자동 rebuild와 갱신을 확인한 뒤 필요하면 합성 기록을 제거합니다.

완료 증빙은 `docs/external-verification.md`에 workflow run, Pages URL, 배포 commit, 암호문 검사 결과를 기록합니다.

## 5. Passphrase 운영

- 암호문은 공개이고 오프라인 대입 공격에 대한 서버 rate limit이 없습니다. password manager가 생성한 긴 무작위 값 또는 충분히 긴 무작위 단어 조합을 사용합니다.
- passphrase를 바꾸면 Secret을 갱신하고 workflow를 다시 실행합니다.
- 과거에 공개된 암호문은 누군가 보관했을 수 있습니다. 이전 passphrase 유출 시 과거 Projection도 노출된 것으로 간주합니다.
- 현재 Dashboard는 passphrase를 저장하지 않습니다. 새로고침하거나 탭을 다시 열면 다시 입력합니다.
- 이 구조는 개인용 정적 암호화에 적합하지만 계정별 권한, 감사 로그, 강제 로그아웃이 필요하면 Cloudflare Access 같은 서버 측 접근 제어로 전환합니다.

## 6. 장애와 복구

- 배포 실패는 private Ledger 원본을 변경하지 않습니다. 마지막 성공 Pages 배포가 계속 제공됩니다.
- 잘못된 Ledger 변경은 Git history에서 되돌리고 다시 push합니다.
- Projection과 암호문은 파생물이므로 삭제 후 언제든 다시 생성할 수 있습니다.
- Token 또는 passphrase가 의심되면 해당 credential을 폐기·회전한 뒤 재배포합니다.
