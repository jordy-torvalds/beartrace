# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-09-30
- Primary product surfaces: 암호 해제 화면, 학습 현황, 보고서 목록/본문
- Evidence reviewed: `README.md`, `docs/ai-authoring.md`, `apps/dashboard/src/App.tsx`, `apps/dashboard/src/model.ts`, `apps/dashboard/src/styles.css`, domain Projection 모델

## Brand
- Personality: 차분하고 신뢰할 수 있는 개인 학습 기록장
- Trust signals: 읽기 전용 UI, 암호화 상태 설명, 기준일과 데이터 형식 표시
- Avoid: 게임화, 과도한 점수화, 불필요한 애니메이션, CRUD 관리 화면처럼 보이는 구성

## Product goals
- Goals: 현재 이해 상태와 다음 행동을 한눈에 보여주고, 저장된 Markdown 보고서를 편하게 다시 읽게 한다.
- Non-goals: 브라우저에서 원장을 수정하거나 GitHub 자격 증명을 다루는 기능
- Success signals: 사용자가 보고서를 제목·본문·주제로 찾고 모바일에서도 무리 없이 읽을 수 있다.

## Personas and jobs
- Primary personas: 기술 자료를 ChatGPT와 깊게 탐구하고 개인 Git 원장에 축적하는 1인 사용자
- User jobs: 학습 상태 확인, 복습 대상 확인, 과거 보고서 검색과 재열람
- Key contexts of use: 데스크톱 집중 학습, 모바일 짧은 복습

## Information architecture
- Primary navigation: `학습 현황`, `보고서`
- Core routes/screens: 단일 정적 앱 안의 현황 화면과 보고서 화면
- Content hierarchy: 전역 지표 → 다음 행동 → 주제 상세 / 보고서 목록 → 보고서 메타데이터 → Markdown 본문

## Design principles
- 행동이 먼저 보이게 한다: 복습 필요와 미검증 지식을 우선 노출한다.
- 원문을 존중한다: 보고서 Markdown의 제목, 표, 목록, 코드 구조를 보존한다.
- 보안 경계를 설명한다: 공개되는 것은 암호문이며 복호화는 현재 브라우저에서만 수행됨을 명시한다.
- Tradeoffs: 정적 앱의 단순성을 위해 별도 라우터, 서버 검색, 편집 기능은 두지 않는다.

## Visual language
- Color: 기존 저채도 녹색과 따뜻한 회색을 유지한다.
- Typography: 시스템 sans-serif, 보고서 본문은 넉넉한 행간과 제한된 읽기 폭을 사용한다.
- Spacing/layout rhythm: 8px 기반 간격, 패널 간 16px, 문서 섹션 간 24~32px
- Shape/radius/elevation: 8~12px 모서리, 낮은 대비의 테두리, 잠금 카드에만 절제된 그림자
- Motion: 로딩 회전 외 필수 모션 없음
- Imagery/iconography: `lucide-react` 선형 아이콘만 사용

## Components
- Existing components to reuse: PanelHeader, TopicDetail, Metric, 상태 라벨, 검색 입력
- New/changed components: 상단 탭 내비게이션, ReportLibrary, ReportDetail, 보고서/주제 칩
- Variants and states: 선택됨, 검색 결과 없음, 보고서 없음, 로딩, 오류, 잠금 해제 중
- Token/component ownership: `apps/dashboard/src/styles.css`가 현재 시각 토큰과 컴포넌트 스타일을 소유한다.

## Accessibility
- Target standard: WCAG 2.1 AA 수준의 대비와 기본 시맨틱을 지향한다.
- Keyboard/focus behavior: 모든 전환과 목록 선택은 button/link로 제공하고 `:focus-visible`을 표시한다.
- Contrast/readability: 본문 최대 읽기 폭과 1.7 이상의 행간을 유지한다.
- Screen-reader semantics: nav, main, article, heading 순서를 사용하고 아이콘은 장식용으로 숨긴다.
- Reduced motion and sensory considerations: `prefers-reduced-motion`에서 회전을 제거한다.

## Responsive behavior
- Supported breakpoints/devices: 320px 이상 모바일과 일반 데스크톱
- Layout adaptations: 보고서 2열은 900px 이하에서 목록과 본문이 세로로 배치된다.
- Touch/hover differences: 행 전체를 충분한 크기의 버튼으로 만들고 hover 없이도 선택 상태가 드러난다.

## Interaction states
- Loading: 한국어 진행 문구와 회전 아이콘
- Empty: 자료가 없는 이유와 private Ledger의 표준 경로를 안내
- Error: 데이터 로드 또는 암호 해제 실패를 구분해 안내
- Success: 별도 토스트 없이 선택된 화면과 데이터로 즉시 전환
- Disabled: 빈 암호 입력 시 열기 버튼 비활성화
- Offline/slow network, if applicable: 마지막 성공 Pages 배포는 정적 자산으로 유지되며 네트워크 실패는 오류 화면으로 표시

## Content voice
- Tone: 간결하고 차분한 한국어 존댓말
- Terminology: Topic은 `주제`, Artifact는 사용자 화면에서 `보고서` 또는 `학습 자료`, Evidence는 `검증 기록`
- Microcopy rules: 상태를 점수로 표현하지 않고 `검증됨`, `복습 필요`, `미검증`처럼 행동 가능한 말로 표현한다.

## Implementation constraints
- Framework/styling system: React 18, Vite, 단일 CSS 파일, `lucide-react`
- Design-token constraints: 기존 색상과 여백을 확장하며 별도 디자인 시스템을 도입하지 않는다.
- Performance constraints: 정적 암호문 1회 로드, 복호화 후 클라이언트 검색; 서버나 DB 없음
- Compatibility constraints: GitHub Pages 프로젝트 하위 경로와 최신 Safari/Chrome 계열 지원
- Test/screenshot expectations: domain/model 단위 테스트와 production build 검증; 실제 Pages에서 평문 JSON이 노출되지 않아야 한다.

## Open questions
- [ ] 보고서 수가 수백 개를 넘으면 연도/태그 필터가 필요한지 실제 사용 후 판단
- [ ] Session/Evidence 본문 열람은 별도 요구가 확인될 때만 검토
