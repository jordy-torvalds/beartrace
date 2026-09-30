# Authoring contract

이 문서는 핵심 불변조건의 요약입니다. 실제 레코드 분류, 표준 경로, 승인 절차는 [AI authoring contract](ai-authoring.md)를 따릅니다. Codex 로컬과 Codex Cloud/Web 모두 같은 규칙을 따르며, 실제 기록은 public engine이 아니라 별도 private Ledger 저장소에 작성합니다.

1. Topic, Artifact, Session, Evidence를 서로 다른 Markdown record로 만듭니다.
2. 시도·오답·피드백은 Session에 append하고, 성공한 척 덮어쓰지 않습니다.
3. Evidence는 AI 평가와 근거를 기록한 뒤 사용자가 승인할 때만 생성합니다.
4. AI가 `insufficient`로 평가했어도 사용자는 명시적인 `override_rationale`을 남겨 승인할 수 있습니다.
5. Recall Evidence는 `validation_context: recall`과 실제 재검증한 `retested_capabilities`를 기록합니다.
6. 기본 전달 방식은 branch/PR입니다. 변경 전후 `pnpm validate && pnpm test`를 실행합니다.
7. Dashboard나 `dist/`를 원장으로 수정하지 않습니다. Projection은 언제든 재생성할 수 있는 파생물입니다.

ChatGPT 대화에서 사용자는 “설명해볼게요”, “새 상황으로 테스트해 주세요”, “실무에서 적용했어요”, “Recall 해보죠” 정도만 말하면 됩니다. 작성 에이전트는 대화 내용을 Session으로 보존하고, 검증이 끝난 능력만 별도의 Evidence 후보로 제시해야 합니다.
