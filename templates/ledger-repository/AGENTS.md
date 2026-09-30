# Private BearTrace Ledger agent contract

이 저장소는 사용자의 **private learning ledger**입니다. 모든 실제 학습 기록은 이곳에만 작성하며 public BearTrace engine 저장소에는 복사하지 않습니다.

## 필수 절차

1. 레코드를 작성하기 전에 public engine의 `docs/ai-authoring.md`를 끝까지 읽습니다.
2. 기존 Topic과 stable ID를 검색한 뒤 `Topic → Artifact → Session → Evidence`의 역할을 분리합니다.
3. 표준 경로를 사용합니다.
   - `topics/<topic-id>/topic.md`
   - `artifacts/<YYYY>/<MM>/<artifact-id>.md`
   - `sessions/<topic-id>/<YYYY-MM-DD>-<session-id>.md`
   - `evidence/<topic-id>/<YYYY-MM-DD>-<evidence-id>.md`
4. Session은 실패·오답·피드백을 포함한 과정을 보존하지만 capability를 부여하지 않습니다.
5. Evidence는 AI 평가, rubric, 명시할 capability를 사용자에게 제시하고 승인받은 뒤에만 만듭니다.
6. `insufficient` Evidence는 사용자가 직접 승격을 선택하고 비어 있지 않은 근거를 남긴 경우에만 허용합니다.
7. Recall은 `validation_context: recall`로 기록하고 실제 다시 검증된 capability만 `retested_capabilities`에 넣습니다.
8. 과거 Evidence는 삭제하거나 성공한 것처럼 고치지 않습니다. 교정은 새 Evidence와 `corrects`/`supersedes` 관계로 남깁니다.
9. 기밀정보, 개인정보, 토큰, 내부 URL은 기록하지 않습니다.
10. 변경 후 engine CLI로 전체 Ledger를 검증하고 기본적으로 branch/PR로 제안합니다.

`user_approved: true`는 사용자의 실제 승인이 있었다는 기록이며 AI가 편의상 채우는 기본값이 아닙니다. Topic 상태와 점수는 Projection 결과이므로 원장에 직접 쓰지 않습니다.
