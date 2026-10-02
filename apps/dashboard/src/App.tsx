import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Paperclip,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ArtifactAttachmentProjection,
  ArtifactProjection,
  Capability,
  Projection,
  SummaryLabel,
  TopicProjection,
} from "@beartrace/domain";
import { decryptUtf8 } from "@beartrace/encryption";
import {
  CAPABILITY_LABELS,
  FRESHNESS_LABELS,
  SUMMARY_LABELS_KO,
  SUMMARY_ORDER,
  currentLabel,
  daysBetween,
  dueCapabilities,
  filterArtifacts,
  freshnessFor,
  overviewMetrics,
  recallDueTopics,
  recentTopics,
  unverifiedTopics,
} from "./model.js";

type LoadState =
  | { status: "loading" }
  | { status: "locked"; envelope: string; message?: string }
  | { status: "unlocking"; envelope: string }
  | { status: "ready"; projection: Projection }
  | { status: "error"; message: string };

type DashboardView = "overview" | "reports";

const capabilityOrder: Capability[] = ["review", "explain", "transfer", "apply"];

const artifactKindLabels: Record<string, string> = {
  article: "글",
  book: "책",
  video: "영상",
  course: "강의",
  paper: "논문",
  documentation: "문서",
  talk: "발표",
  exercise: "연습",
  other: "보고서",
};

function formatDate(date: string | null): string {
  if (!date) return "없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function labelClass(label: SummaryLabel | "NEW"): string {
  return `label label-${label.toLowerCase()}`;
}

function labelText(label: SummaryLabel | "NEW"): string {
  return SUMMARY_LABELS_KO[label];
}

async function loadEncryptedProjection(): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}dashboard.enc.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`암호화된 학습 데이터를 불러오지 못했습니다. (HTTP ${response.status})`);
  }
  return response.text();
}

function parseProjection(plaintext: string): Projection {
  const value = JSON.parse(plaintext) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    !("schema_version" in value) ||
    !("as_of" in value) ||
    !("topics" in value) ||
    !Array.isArray(value.topics) ||
    !("artifacts" in value) ||
    !Array.isArray(value.artifacts)
  ) {
    throw new Error("복호화한 데이터가 올바른 BearTrace 형식이 아닙니다.");
  }
  return value as Projection;
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;
    loadEncryptedProjection()
      .then((envelope) => {
        if (mounted) setLoadState({ status: "locked", envelope });
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadState({
            status: "error",
            message: error instanceof Error ? error.message : "학습 데이터를 불러오지 못했습니다.",
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function unlock(passphrase: string): Promise<void> {
    if (loadState.status !== "locked") return;
    const { envelope } = loadState;
    setLoadState({ status: "unlocking", envelope });
    try {
      const plaintext = await decryptUtf8(envelope, passphrase);
      setLoadState({ status: "ready", projection: parseProjection(plaintext) });
    } catch {
      setLoadState({
        status: "locked",
        envelope,
        message: "열지 못했습니다. 암호가 맞는지 확인해 주세요.",
      });
    }
  }

  if (loadState.status === "loading") {
    return (
      <main className="app-shell">
        <section className="empty-state" aria-live="polite">
          <RefreshCcw className="spin" aria-hidden="true" />
          <h1>BearTrace</h1>
          <p>학습 기록을 불러오는 중입니다.</p>
        </section>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="app-shell">
        <section className="empty-state" role="alert">
          <AlertTriangle aria-hidden="true" />
          <h1>BearTrace</h1>
          <p>{loadState.message}</p>
        </section>
      </main>
    );
  }

  if (loadState.status === "locked") {
    return <UnlockGate message={loadState.message} onUnlock={unlock} />;
  }

  if (loadState.status === "unlocking") {
    return (
      <main className="app-shell">
        <section className="empty-state unlock-state" aria-live="polite">
          <RefreshCcw className="spin" aria-hidden="true" />
          <h1>학습 기록을 여는 중입니다</h1>
          <p>현재 브라우저에서 안전하게 복호화하고 있습니다.</p>
        </section>
      </main>
    );
  }

  return <Dashboard projection={loadState.projection} />;
}

function UnlockGate({ message, onUnlock }: { message?: string; onUnlock: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");

  return (
    <main className="app-shell">
      <section className="unlock-card">
        <div className="unlock-icon"><LockKeyhole aria-hidden="true" /></div>
        <p className="eyebrow">BearTrace</p>
        <h1>나의 학습 기록 열기</h1>
        <p className="unlock-copy">
          공개된 대시보드에는 암호화된 데이터만 저장됩니다. 입력한 암호는 현재 탭에서만 사용되며 서버로 전송되지 않습니다.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onUnlock(passphrase);
          }}
        >
          <label htmlFor="dashboard-passphrase">대시보드 암호</label>
          <input
            id="dashboard-passphrase"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          {message ? <p className="unlock-error" role="alert">{message}</p> : null}
          <button type="submit" disabled={passphrase.trim().length === 0}>학습 기록 열기</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ projection }: { projection: Projection }) {
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [topicQuery, setTopicQuery] = useState("");
  const [reportQuery, setReportQuery] = useState("");

  function openReport(id: string): void {
    setSelectedArtifactId(id);
    setActiveView("reports");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BearTrace</p>
          <h1>나의 학습 흔적</h1>
        </div>
        <div className="build-meta">
          <span>기준일 {formatDate(projection.as_of)}</span>
          <span>데이터 형식 v{projection.schema_version}</span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="대시보드 화면">
        <button
          type="button"
          className={activeView === "overview" ? "view-tab active" : "view-tab"}
          aria-pressed={activeView === "overview"}
          onClick={() => setActiveView("overview")}
        >
          <LayoutDashboard aria-hidden="true" />
          학습 현황
        </button>
        <button
          type="button"
          className={activeView === "reports" ? "view-tab active" : "view-tab"}
          aria-pressed={activeView === "reports"}
          onClick={() => setActiveView("reports")}
        >
          <FileText aria-hidden="true" />
          보고서
          <span className="tab-count">{projection.artifacts.length}</span>
        </button>
      </nav>

      {activeView === "overview" ? (
        <Overview
          projection={projection}
          selectedTopicId={selectedTopicId}
          setSelectedTopicId={setSelectedTopicId}
          query={topicQuery}
          setQuery={setTopicQuery}
          onOpenReport={openReport}
        />
      ) : (
        <ReportLibrary
          projection={projection}
          selectedArtifactId={selectedArtifactId}
          setSelectedArtifactId={setSelectedArtifactId}
          query={reportQuery}
          setQuery={setReportQuery}
        />
      )}
    </main>
  );
}

interface OverviewProps {
  projection: Projection;
  selectedTopicId: string | null;
  setSelectedTopicId: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  onOpenReport: (id: string) => void;
}

function Overview({ projection, selectedTopicId, setSelectedTopicId, query, setQuery, onOpenReport }: OverviewProps) {
  const dueTopics = useMemo(() => recallDueTopics(projection), [projection]);
  const backlogTopics = useMemo(() => unverifiedTopics(projection), [projection]);
  const recent = useMemo(() => recentTopics(projection), [projection]);
  const metrics = useMemo(() => overviewMetrics(projection), [projection]);
  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (normalized.length === 0) return projection.topics;
    return projection.topics.filter((topic) => {
      const searchable = [topic.title, topic.id, ...topic.tags].join(" ").toLocaleLowerCase("ko-KR");
      return searchable.includes(normalized);
    });
  }, [projection.topics, query]);

  const selectedTopic = projection.topics.find((topic) => topic.id === selectedTopicId)
    ?? filteredTopics[0]
    ?? projection.topics[0]
    ?? null;

  return (
    <>
      <section className="metrics-grid" aria-label="학습 현황 요약">
        {metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="main-column">
          <section className="panel">
            <PanelHeader icon={<CalendarClock aria-hidden="true" />} title="복습할 주제" aside={`${dueTopics.length}개`} />
            <div className="queue-list">
              {dueTopics.length === 0 ? <p className="muted">지금 복습할 주제가 없습니다.</p> : dueTopics.map((topic) => (
                <QueueRow key={topic.id} topic={topic} asOf={projection.as_of} onSelect={setSelectedTopicId} />
              ))}
            </div>
          </section>

          <section className="panel">
            <PanelHeader icon={<ShieldCheck aria-hidden="true" />} title="최근 학습" />
            {recent.length === 0 ? <p className="muted">아직 학습 기록이 없습니다.</p> : (
              <div className="recent-grid">
                {recent.map((topic) => {
                  const label = currentLabel(topic);
                  return (
                    <button className="recent-item" key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)}>
                      <span>{topic.title}</span>
                      <small className={labelClass(label)}>{labelText(label)}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <PanelHeader icon={<Archive aria-hidden="true" />} title="검증 대기 지식" aside={`${backlogTopics.length}개`} />
            <BacklogChart projection={projection} />
            <div className="backlog-list">
              {backlogTopics.slice(0, 6).map((topic) => (
                <button className="backlog-row" key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)}>
                  <span>{topic.title}</span>
                  <small>{daysBetween(topic.last_activity?.date ?? topic.created_at, projection.as_of)}일 경과</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel">
            <PanelHeader icon={<Layers3 aria-hidden="true" />} title="주제" aside={`${filteredTopics.length}개`} />
            <label className="search-box">
              <Search aria-hidden="true" />
              <span className="sr-only">주제 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 또는 태그 검색" />
            </label>
            <div className="topic-list">
              {filteredTopics.length === 0 ? <p className="muted">검색 결과가 없습니다.</p> : null}
              {filteredTopics.map((topic) => {
                const label = currentLabel(topic);
                return (
                  <button className={topic.id === selectedTopic?.id ? "topic-row active" : "topic-row"} key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)}>
                    <span>{topic.title}</span>
                    <small>{labelText(label)}</small>
                  </button>
                );
              })}
            </div>
          </section>
          {selectedTopic ? <TopicDetail topic={selectedTopic} onOpenReport={onOpenReport} /> : null}
        </aside>
      </section>
    </>
  );
}

interface ReportLibraryProps {
  projection: Projection;
  selectedArtifactId: string | null;
  setSelectedArtifactId: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
}

function ReportLibrary({ projection, selectedArtifactId, setSelectedArtifactId, query, setQuery }: ReportLibraryProps) {
  const reports = useMemo(() => filterArtifacts(projection, query), [projection, query]);
  const selectedReport = reports.find((artifact) => artifact.id === selectedArtifactId) ?? reports[0] ?? null;
  const topicsById = useMemo(() => new Map(projection.topics.map((topic) => [topic.id, topic])), [projection.topics]);

  return (
    <section className="reports-layout">
      <aside className="panel report-index">
        <PanelHeader icon={<FileText aria-hidden="true" />} title="보고서 보관함" aside={`${reports.length}개`} />
        <label className="search-box">
          <Search aria-hidden="true" />
          <span className="sr-only">보고서 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 본문 또는 주제 검색" />
        </label>
        <div className="report-list">
          {projection.artifacts.length === 0 ? (
            <div className="report-empty-copy">
              <p>아직 저장된 보고서가 없습니다.</p>
              <small>Private Ledger의 `artifacts/YYYY/MM/` 아래에 Markdown 보고서를 추가하면 여기에 표시됩니다.</small>
            </div>
          ) : reports.length === 0 ? <p className="muted">검색 결과가 없습니다.</p> : reports.map((artifact) => (
            <button type="button" key={artifact.id} className={artifact.id === selectedReport?.id ? "report-list-item active" : "report-list-item"} onClick={() => setSelectedArtifactId(artifact.id)}>
              <span className="report-list-meta">
                <span>{artifactKindLabels[artifact.kind] ?? "자료"}</span>
                <time dateTime={artifact.date}>{formatDate(artifact.date)}</time>
              </span>
              <strong>{artifact.title}</strong>
              <span className="report-topic-summary">{artifact.topic_ids.map((id) => topicsById.get(id)?.title ?? id).join(" · ")}</span>
            </button>
          ))}
        </div>
      </aside>

      {selectedReport ? <ReportDetail artifact={selectedReport} topicsById={topicsById} /> : (
        <section className="panel report-placeholder">
          <BookOpen aria-hidden="true" />
          <h2>읽을 보고서를 선택해 주세요</h2>
        </section>
      )}
    </section>
  );
}

function ReportDetail({ artifact, topicsById }: { artifact: ArtifactProjection; topicsById: Map<string, TopicProjection> }) {
  const sourceIsLink = artifact.source.kind === "url" && /^https?:\/\//.test(artifact.source.value);
  const attachments = artifact.attachments ?? [];
  const htmlAttachment = attachments.find((attachment) => attachment.media_type === "text/html");
  const readerRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<"markdown" | "html" | "files">("markdown");
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  useEffect(() => {
    setView("markdown");
    setFallbackFullscreen(false);
  }, [artifact.id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setNativeFullscreen(document.fullscreenElement === readerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const fullscreenActive = nativeFullscreen || fallbackFullscreen;

  async function toggleFullscreen(): Promise<void> {
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    const reader = readerRef.current;
    if (!reader?.requestFullscreen) {
      setFallbackFullscreen(true);
      return;
    }
    try {
      await reader.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  }

  return (
    <article ref={readerRef} className={`panel report-reader${fallbackFullscreen ? " immersive-fallback" : ""}`}>
      <header className="report-header">
        <div className="report-heading-row">
          <div>
            <p className="eyebrow">{artifactKindLabels[artifact.kind] ?? "학습 자료"}</p>
            <h2>{artifact.title}</h2>
          </div>
          <button type="button" className="report-action-button" onClick={() => void toggleFullscreen()} aria-label={fullscreenActive ? "전체 화면 닫기" : "전체 화면으로 보기"}>
            {fullscreenActive ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            <span>{fullscreenActive ? "닫기" : "전체 화면"}</span>
          </button>
        </div>
        <div className="report-metadata">
          <time dateTime={artifact.date}>{formatDate(artifact.date)}</time>
          <span aria-hidden="true">·</span>
          {sourceIsLink ? (
            <a href={artifact.source.value} target="_blank" rel="noreferrer">원문 열기 <ExternalLink aria-hidden="true" /></a>
          ) : <span>출처: {artifact.source.value}</span>}
        </div>
        <div className="topic-chips" aria-label="연결된 주제">
          {artifact.topic_ids.map((id) => <span className="topic-chip" key={id}>{topicsById.get(id)?.title ?? id}</span>)}
        </div>
        {artifact.source.note ? <p className="source-note">{artifact.source.note}</p> : null}
      </header>
      {attachments.length > 0 ? (
        <div className="report-view-tabs" role="tablist" aria-label="보고서 원문 보기">
          <button
            type="button"
            role="tab"
            aria-selected={view === "markdown"}
            className={view === "markdown" ? "report-view-tab active" : "report-view-tab"}
            onClick={() => setView("markdown")}
          >
            구조화된 Markdown
          </button>
          {htmlAttachment ? (
            <button
              type="button"
              role="tab"
              aria-selected={view === "html"}
              className={view === "html" ? "report-view-tab active" : "report-view-tab"}
              onClick={() => setView("html")}
            >
              HTML 원본
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={view === "files"}
            className={view === "files" ? "report-view-tab active" : "report-view-tab"}
            onClick={() => setView("files")}
          >
            <Paperclip aria-hidden="true" /> 첨부 파일 <span className="tab-count">{attachments.length}</span>
          </button>
        </div>
      ) : null}
      {view === "html" && htmlAttachment ? (
        <section className="html-original" aria-label="HTML 원본">
          <p className="html-original-note">
            잠금 해제된 현재 브라우저에서만 표시합니다. 스크립트는 실행하지 않습니다. 파일명: {htmlAttachment.path}
          </p>
          <iframe
            title={`${artifact.title} HTML 원본`}
            className="html-original-frame"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={htmlAttachment.content}
          />
        </section>
      ) : view === "files" ? (
        <AttachmentList attachments={attachments} onViewHtml={() => setView("html")} />
      ) : (
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
          }}>
            {artifact.body_markdown}
          </ReactMarkdown>
        </div>
      )}
    </article>
  );
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentFilename(filePath: string): string {
  return filePath.split("/").at(-1) ?? filePath;
}

function attachmentKind(mediaType: string): string {
  if (mediaType === "text/html") return "HTML";
  if (mediaType === "text/markdown") return "Markdown";
  if (mediaType === "application/pdf") return "PDF";
  return mediaType;
}

function AttachmentLink({ attachment }: { attachment: ArtifactAttachmentProjection }) {
  const href = useMemo(() => {
    const bytes = attachment.encoding === "base64"
      ? Uint8Array.from(atob(attachment.content), (character) => character.charCodeAt(0))
      : attachment.content;
    const blob = new Blob([bytes], { type: attachment.media_type });
    return URL.createObjectURL(blob);
  }, [attachment]);

  useEffect(() => () => URL.revokeObjectURL(href), [href]);

  return (
    <div className="attachment-actions">
      {attachment.media_type !== "text/html" ? (
        <a href={href} target="_blank" rel="noreferrer">열기</a>
      ) : null}
      <a href={href} download={attachmentFilename(attachment.path)}>
        <Download aria-hidden="true" /> 다운로드
      </a>
    </div>
  );
}

function AttachmentList({ attachments, onViewHtml }: { attachments: ArtifactAttachmentProjection[]; onViewHtml: () => void }) {
  return (
    <section className="attachments-panel" aria-label="첨부 파일 목록">
      <div className="attachments-heading">
        <div>
          <p className="eyebrow">원본 파일</p>
          <h3>보고서에 연결된 첨부 파일</h3>
        </div>
        <span>{attachments.length}개</span>
      </div>
      <p className="attachments-note">파일은 대시보드 잠금 해제 후 현재 브라우저에서만 복원됩니다.</p>
      <div className="attachment-list">
        {attachments.map((attachment) => (
          <div className="attachment-row" key={attachment.path}>
            <div className="attachment-icon"><FileText aria-hidden="true" /></div>
            <div className="attachment-info">
              <strong>{attachmentFilename(attachment.path)}</strong>
              <span>{attachmentKind(attachment.media_type)} · {formatFileSize(attachment.size_bytes)}</span>
            </div>
            {attachment.media_type === "text/html" ? (
              <button type="button" className="attachment-view-button" onClick={onViewHtml}>화면에서 보기</button>
            ) : null}
            <AttachmentLink attachment={attachment} />
          </div>
        ))}
      </div>
    </section>
  );
}

interface PanelHeaderProps { icon: React.ReactNode; title: string; aside?: string; }

function PanelHeader({ icon, title, aside }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-title">{icon}<h2>{title}</h2></div>
      {aside ? <span>{aside}</span> : null}
    </div>
  );
}

interface QueueRowProps { topic: TopicProjection; asOf: string; onSelect: (id: string) => void; }

function QueueRow({ topic, asOf, onSelect }: QueueRowProps) {
  const overdueDays = topic.next_recall ? Math.max(0, daysBetween(topic.next_recall, asOf)) : 0;
  const capabilities = dueCapabilities(topic).map((freshness) => `${CAPABILITY_LABELS[freshness.capability]} · ${FRESHNESS_LABELS[freshness.status]}`).join(", ");
  return (
    <button className="queue-row" type="button" onClick={() => onSelect(topic.id)}>
      <div><strong>{topic.title}</strong><span>{capabilities || "복습 필요"}</span><span>{topic.next_recall ? formatDate(topic.next_recall) : "예정일 없음"}</span></div>
      <small>{overdueDays === 0 ? "오늘" : `${overdueDays}일 지남`}</small>
    </button>
  );
}

function BacklogChart({ projection }: { projection: Projection }) {
  const max = Math.max(1, projection.topics.length);
  const rows = SUMMARY_ORDER.map((label) => {
    const count = projection.topics.filter((topic) => topic.summary_labels.includes(label)).length;
    return { label, count, width: `${Math.round((count / max) * 100)}%` };
  });
  return (
    <div className="backlog-chart">
      {rows.map((row) => (
        <div className="backlog-bar" key={row.label}>
          <span>{SUMMARY_LABELS_KO[row.label]}</span>
          <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: row.width }} /></div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function TopicDetail({ topic, onOpenReport }: { topic: TopicProjection; onOpenReport: (id: string) => void }) {
  const missing = topic.missing_capabilities.map((capability) => CAPABILITY_LABELS[capability]).join(", ");
  const label = currentLabel(topic);
  return (
    <section className="panel detail-panel">
      <div className="detail-heading">
        <div><p className="eyebrow">주제 상세</p><h2>{topic.title}</h2></div>
        <span className={labelClass(label)}>{labelText(label)}</span>
      </div>
      <div className="detail-stats">
        <Stat label="보고서" value={topic.artifacts.length} />
        <Stat label="학습 과정" value={topic.sessions.length} />
        <Stat label="검증 기록" value={topic.evidence.length} />
      </div>
      <div className="capability-grid">
        {capabilityOrder.map((capability) => {
          const freshness = freshnessFor(topic, capability);
          return (
            <div className="capability" key={capability}>
              {freshness?.status === "valid" ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
              <div><strong>{CAPABILITY_LABELS[capability]}</strong><span>{FRESHNESS_LABELS[freshness?.status ?? "never"]}</span></div>
            </div>
          );
        })}
      </div>
      <div className="detail-section">
        <h3>보고서</h3>
        {topic.artifacts.length === 0 ? <p className="muted">연결된 보고서가 없습니다.</p> : topic.artifacts.map((artifact) => (
          <button className="timeline-row timeline-button" key={artifact.id} type="button" onClick={() => onOpenReport(artifact.id)}>
            <BookOpen aria-hidden="true" /><span>{artifact.title}</span><small>{formatDate(artifact.date)}</small>
          </button>
        ))}
      </div>
      <div className="detail-section">
        <h3>검증 기록</h3>
        {topic.evidence.length === 0 ? <p className="muted">아직 검증 기록이 없습니다.</p> : topic.evidence.map((evidence) => (
          <div className="timeline-row" key={evidence.id}>
            <ShieldCheck aria-hidden="true" /><span>{evidence.capabilities.map((capability) => CAPABILITY_LABELS[capability]).join(", ")}</span><small>{formatDate(evidence.date)}</small>
          </div>
        ))}
      </div>
      <div className="detail-footer">
        <span>부족한 검증: {missing.length > 0 ? missing : "없음"}</span>
        <span>다음 복습: {formatDate(topic.next_recall)}</span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}
