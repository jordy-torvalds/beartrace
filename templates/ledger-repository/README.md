# BearTrace private ledger

이 저장소는 개인 학습 원본을 보관하는 private repository입니다. Public BearTrace engine과 분리해 유지합니다.

## 디렉터리

```text
topics/       개념 정의
artifacts/    읽거나 생성한 학습 자료
sessions/     시도·질문·오답·피드백 과정
evidence/     사용자 승인까지 끝난 능력 증거
config/       Recall 설정
```

작성 규칙은 `AGENTS.md`와 public engine의 `docs/ai-authoring.md`를 따릅니다.

## 대시보드 자동 갱신

`main`에 자료가 반영되면 `notify-dashboard.yml`이 public engine 저장소에 `ledger-updated` 이벤트를 보냅니다.

이 private 저장소에 다음을 설정합니다.

- Repository variable `BEARTRACE_ENGINE_REPOSITORY`: `owner/beartrace`
- Repository secret `BEARTRACE_DEPLOY_TOKEN`: 위 public 저장소 하나에만 접근하며 `Contents: write` 권한을 가진 fine-grained token

실제 Ledger를 읽는 token과 대시보드 암호는 public engine 저장소의 Actions secret에 별도로 둡니다. 어떤 secret도 Markdown이나 대화에 입력하지 않습니다.
