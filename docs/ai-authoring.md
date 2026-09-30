# AI authoring contract

이 문서는 Codex, ChatGPT 또는 다른 작성 에이전트가 **별도 private BearTrace Ledger 저장소**에 학습 자료를 기록할 때 지켜야 하는 규칙입니다. Public engine 저장소에는 실제 학습 자료를 작성하지 않습니다.

## 먼저 레코드 종류를 결정합니다

| 레코드 | 사용하는 경우 | 표준 위치 | 상태에 미치는 영향 |
|---|---|---|---|
| Topic | 지속적으로 학습·검증할 하나의 개념 단위를 정의할 때 | `topics/<topic-id>/topic.md` | 정의만으로는 능력을 부여하지 않음 |
| Artifact | 읽거나 생성한 리포트·글·논문·문서 등 학습 재료를 보존할 때 | `artifacts/<YYYY>/<MM>/<artifact-id>.md` | 존재하면 `COLLECTED` |
| Session | 설명 시도, 질문, 오답, 수정, 피드백, Recall 과정을 기록할 때 | `sessions/<topic-id>/<YYYY-MM-DD>-<session-id>.md` | 과정만 보존하며 능력을 부여하지 않음 |
| Evidence | 특정 능력이 충분히 입증되고 사용자가 승격을 승인했을 때 | `evidence/<topic-id>/<YYYY-MM-DD>-<evidence-id>.md` | 명시된 capability만 부여 |

한 문서가 여러 역할을 한다고 합치지 않습니다. ChatGPT가 만든 심층 리포트는 Artifact이고, 그 리포트를 두고 대화한 과정은 Session이며, 검증을 통과한 설명은 별도의 Evidence입니다.

## 작성 순서

1. private Ledger 저장소인지 확인합니다. Public engine 저장소라면 중단하고 private Ledger 경로를 확인합니다.
2. 기존 `topics/`를 검색해 같은 개념이 있는지 확인합니다. 표현만 다른 기존 Topic이 있으면 새 Topic을 만들지 않습니다.
3. 적합한 Topic이 없을 때만 Topic을 먼저 만듭니다. ID는 소문자 kebab-case이며 생성 후 바꾸지 않습니다.
4. 외부 또는 AI 생성 학습 자료는 Artifact로 저장합니다. 여러 Topic에 걸치면 하나의 Artifact에서 모든 `topic_ids`를 참조합니다. Artifact 본문은 암호화된 Dashboard Projection에 포함되어 `보고서` 화면에서 렌더링되므로, 제목 구조·목록·표·코드 블록을 갖춘 읽기 좋은 Markdown으로 작성합니다.
5. 학습 대화나 테스트가 있었다면 성공 여부와 관계없이 Session에 시도·오답·교정·피드백을 보존합니다. 실패한 Recall도 Session입니다.
6. Topic의 `validation_criteria`를 기준으로 AI 평가와 rubric 결과를 작성합니다.
7. 평가가 충분하더라도 Evidence 후보와 부여할 capability를 사용자에게 보여주고 명시적으로 승인을 받은 뒤에만 Evidence를 생성합니다. 사용자의 “저장해 주세요”, “Evidence로 승격해 주세요”처럼 후보에 대한 분명한 요청은 승인으로 봅니다.
8. AI 평가가 `insufficient`이면 기본적으로 Session만 남깁니다. 사용자가 근거와 함께 승격을 요구한 경우에만 원래 평가를 유지하고 `override_rationale`을 기록합니다.
9. Evidence를 만들었다면 같은 Session의 `outcome`과 `evidence_ids`를 일치시킵니다. 기존 시도나 오답을 본문에서 삭제하지 않습니다.
10. 검증을 통과한 뒤 branch/PR로 제안합니다. 과거 Evidence의 오류는 덮어쓰지 말고 새 Evidence의 `corrects` 또는 `supersedes`로 연결합니다.

## Capability 판정

- `review`: 자료를 단순히 읽은 것이 아니라 핵심을 선별·비판·재구성한 증거가 있습니다.
- `explain`: 자료 없이 자기 언어로 핵심, 원인과 결과, 한계를 충분히 설명했습니다.
- `transfer`: 학습 당시 보지 않은 새로운 상황에 개념을 적용하고 판단 근거를 제시했습니다.
- `apply`: 실제 설계·업무·개인 프로젝트에서 사용한 구체적 결정과 결과가 있습니다. 기밀 세부사항은 기록하지 않습니다.

Capability는 단계형 전제조건이 아닙니다. 한 Evidence가 여러 능력을 실제로 입증할 때만 여러 값을 넣습니다. `UNDERSTOOD`와 현재 학습 DONE은 검증된 `explain + transfer`의 Projection 결과이며 frontmatter에 직접 쓰지 않습니다.

Recall은 별도 능력이 아닙니다. Recall Session에는 `recall_attempt`와 실제 시험한 `tested_capabilities`를 기록하고, 성공한 Recall Evidence에는 `validation_context: recall`과 실제 다시 검증된 `retested_capabilities`만 기록합니다.

## 경로와 ID 규칙

- Topic: `topics/connection-pool/topic.md`, ID `connection-pool`
- Artifact: `artifacts/2026/09/report-connection-pool-sizing.md`
- Session: `sessions/connection-pool/2026-09-22-session-connection-pool-explain-01.md`
- Evidence: `evidence/connection-pool/2026-09-22-evidence-connection-pool-explain-01.md`

모든 ID는 저장소 전체에서 유일해야 합니다. 날짜는 실제 사용자 기준 날짜를 `YYYY-MM-DD`로 기록하며 추측하지 않습니다. 파일 경로는 탐색 편의를 위한 것이고 참조의 정체성은 immutable ID입니다.

## 자료별 처리 예시

- URL의 기술 글을 저장: Artifact `kind`는 실제 매체에 맞추고 `source.kind: url`을 사용합니다.
- ChatGPT가 새로 작성한 리포트: Artifact `kind: other`, `source.kind: other`, `source.value: chatgpt`를 사용하고 생성 배경을 본문에 남깁니다.
- 개인 설계 문서: Artifact `kind: other`, `source.kind: internal`을 사용하되 회사명, 고객 정보, 내부 URL, 계정, 토큰 등은 제거합니다.
- 읽으며 남긴 짧은 메모: 우선 Session의 review 과정입니다. 검증된 재구성이나 비판이 있을 때만 별도 `review` Evidence를 만듭니다.
- 설명 또는 문제 풀이: Session을 먼저 만들고, 검증과 사용자 승인 후 Evidence를 분리합니다.

## 금지 사항

- Topic에 `status`, 점수, `UNDERSTOOD` 같은 계산 결과를 저장하지 않습니다.
- Session만으로 capability를 부여하지 않습니다.
- 사용자 승인 없이 `user_approved: true`를 만들어내지 않습니다.
- AI 평가가 부족한데 `sufficient`로 바꾸거나 override 근거를 대신 만들어내지 않습니다.
- 원문 transcript 전체가 필요하지 않다면 개인정보와 민감정보까지 복사하지 않습니다.
- `dist/`, Pages 산출물, `dashboard.enc.json`을 원장처럼 수정하지 않습니다.
- Artifact 본문은 암호화되어 배포되지만 passphrase 유출 시 읽을 수 있으므로 회사 기밀, 개인정보, 토큰, 내부 URL을 넣지 않습니다.

## 검증 명령

Public engine과 private Ledger가 형제 디렉터리라고 가정한 예시입니다.

```bash
ENGINE_DIR=../beartrace
pnpm --dir "$ENGINE_DIR" build
pnpm --dir "$ENGINE_DIR" --filter @beartrace/cli exec node dist/cli.js validate --root "$PWD"
pnpm --dir "$ENGINE_DIR" --filter @beartrace/cli exec node dist/cli.js build-projection \
  --root "$PWD" \
  --config "$PWD/config/beartrace.config.json" \
  --as-of 2026-09-30 \
  --out "$TMPDIR/beartrace-projection.json"
```

오류가 있으면 Evidence 기준을 낮추거나 필드를 임의로 제거하지 말고 원인과 수정 내용을 사용자에게 알립니다.
