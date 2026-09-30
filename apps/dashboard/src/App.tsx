import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Layers3,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Capability, Projection, SummaryLabel, TopicProjection } from "@beartrace/domain";
import { decryptUtf8 } from "@beartrace/encryption";
import {
  CAPABILITY_LABELS,
  SUMMARY_ORDER,
  currentLabel,
  daysBetween,
  dueCapabilities,
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

const capabilityOrder: Capability[] = ["review", "explain", "transfer", "apply"];

function formatDate(date: string | null): string {
  if (!date) return "None";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function labelClass(label: SummaryLabel | "NEW"): string {
  return `label label-${label.toLowerCase()}`;
}

async function loadEncryptedProjection(): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}dashboard.enc.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`dashboard.enc.json returned HTTP ${response.status}`);
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
    !Array.isArray(value.topics)
  ) {
    throw new Error("Decrypted content is not a BearTrace projection");
  }
  return value as Projection;
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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
            message: error instanceof Error ? error.message : "Unable to load projection",
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
        message: "Unable to unlock. The passphrase is incorrect or the encrypted data is damaged.",
      });
    }
  }

  if (loadState.status === "loading") {
    return (
      <main className="app-shell">
        <section className="empty-state">
          <RefreshCcw aria-hidden="true" />
          <h1>BearTrace</h1>
          <p>Loading dashboard projection...</p>
        </section>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="app-shell">
        <section className="empty-state">
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
          <h1>Unlocking BearTrace</h1>
          <p>Decrypting the learning projection in this browser...</p>
        </section>
      </main>
    );
  }

  return (
    <Dashboard
      projection={loadState.projection}
      selectedTopicId={selectedTopicId}
      setSelectedTopicId={setSelectedTopicId}
      query={query}
      setQuery={setQuery}
    />
  );
}

function UnlockGate({ message, onUnlock }: { message?: string; onUnlock: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");

  return (
    <main className="app-shell">
      <section className="unlock-card">
        <div className="unlock-icon"><LockKeyhole aria-hidden="true" /></div>
        <p className="eyebrow">BearTrace</p>
        <h1>Unlock your learning trail</h1>
        <p className="unlock-copy">
          The published dashboard is encrypted. Your passphrase is used only in this tab and is never sent to a server.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onUnlock(passphrase);
          }}
        >
          <label htmlFor="dashboard-passphrase">Dashboard passphrase</label>
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
          <button type="submit" disabled={passphrase.trim().length === 0}>Unlock dashboard</button>
        </form>
      </section>
    </main>
  );
}

interface DashboardProps {
  projection: Projection;
  selectedTopicId: string | null;
  setSelectedTopicId: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
}

function Dashboard({ projection, selectedTopicId, setSelectedTopicId, query, setQuery }: DashboardProps) {
  const dueTopics = useMemo(() => recallDueTopics(projection), [projection]);
  const backlogTopics = useMemo(() => unverifiedTopics(projection), [projection]);
  const recent = useMemo(() => recentTopics(projection), [projection]);
  const metrics = useMemo(() => overviewMetrics(projection), [projection]);
  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return projection.topics;
    return projection.topics.filter((topic) => {
      const searchable = [topic.title, topic.id, ...topic.tags].join(" ").toLowerCase();
      return searchable.includes(normalized);
    });
  }, [projection.topics, query]);

  const selectedTopic =
    projection.topics.find((topic) => topic.id === selectedTopicId) ??
    filteredTopics[0] ??
    projection.topics[0] ??
    null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BearTrace</p>
          <h1>Your Learning Trail</h1>
        </div>
        <div className="build-meta">
          <span>As of {formatDate(projection.as_of)}</span>
          <span>Schema v{projection.schema_version}</span>
        </div>
      </header>

      <section className="metrics-grid" aria-label="Overview metrics">
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
            <PanelHeader icon={<CalendarClock aria-hidden="true" />} title="Recall Queue" aside={`${dueTopics.length} due`} />
            <div className="queue-list">
              {dueTopics.length === 0 ? (
                <p className="muted">No recall due.</p>
              ) : (
                dueTopics.map((topic) => <QueueRow key={topic.id} topic={topic} asOf={projection.as_of} onSelect={setSelectedTopicId} />)
              )}
            </div>
          </section>

          <section className="panel">
            <PanelHeader icon={<ShieldCheck aria-hidden="true" />} title="Recently Learned" />
            <div className="recent-grid">
              {recent.map((topic) => (
                <button className="recent-item" key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)}>
                  <span>{topic.title}</span>
                  <small className={labelClass(currentLabel(topic))}>{currentLabel(topic)}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <PanelHeader icon={<Archive aria-hidden="true" />} title="Knowledge Backlog" aside={`${backlogTopics.length} unverified`} />
            <BacklogChart projection={projection} />
            <div className="backlog-list">
              {backlogTopics.slice(0, 6).map((topic) => (
                <button className="backlog-row" key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)}>
                  <span>{topic.title}</span>
                  <small>{daysBetween(topic.last_activity?.date ?? topic.created_at, projection.as_of)} days</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel">
            <PanelHeader icon={<Layers3 aria-hidden="true" />} title="Topics" aside={`${filteredTopics.length}`} />
            <label className="search-box">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics" />
            </label>
            <div className="topic-list">
              {filteredTopics.map((topic) => (
                <button
                  className={topic.id === selectedTopic?.id ? "topic-row active" : "topic-row"}
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                >
                  <span>{topic.title}</span>
                  <small>{currentLabel(topic)}</small>
                </button>
              ))}
            </div>
          </section>

          {selectedTopic ? <TopicDetail topic={selectedTopic} /> : null}
        </aside>
      </section>
    </main>
  );
}

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  aside?: string;
}

function PanelHeader({ icon, title, aside }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {aside ? <span>{aside}</span> : null}
    </div>
  );
}

interface QueueRowProps {
  topic: TopicProjection;
  asOf: string;
  onSelect: (id: string) => void;
}

function QueueRow({ topic, asOf, onSelect }: QueueRowProps) {
  const overdueDays = topic.next_recall ? Math.max(0, daysBetween(topic.next_recall, asOf)) : 0;
  const capabilities = dueCapabilities(topic)
    .map((freshness) => `${CAPABILITY_LABELS[freshness.capability]} (${freshness.status})`)
    .join(", ");

  return (
    <button className="queue-row" type="button" onClick={() => onSelect(topic.id)}>
      <div>
        <strong>{topic.title}</strong>
        <span>{capabilities || "Recall due"}</span>
        <span>{topic.next_recall ? formatDate(topic.next_recall) : "No date"}</span>
      </div>
      <small>{overdueDays === 0 ? "Today" : `${overdueDays} days late`}</small>
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
          <span>{row.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: row.width }} />
          </div>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function TopicDetail({ topic }: { topic: TopicProjection }) {
  const missing = topic.missing_capabilities.map((capability) => CAPABILITY_LABELS[capability]).join(", ");

  return (
    <section className="panel detail-panel">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Topic Detail</p>
          <h2>{topic.title}</h2>
        </div>
        <span className={labelClass(currentLabel(topic))}>{currentLabel(topic)}</span>
      </div>

      <div className="detail-stats">
        <Stat label="Artifacts" value={topic.artifacts.length} />
        <Stat label="Sessions" value={topic.sessions.length} />
        <Stat label="Evidence" value={topic.evidence.length} />
      </div>

      <div className="capability-grid">
        {capabilityOrder.map((capability) => {
          const freshness = freshnessFor(topic, capability);
          return (
            <div className="capability" key={capability}>
              {freshness?.status === "valid" ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
              <div>
                <strong>{CAPABILITY_LABELS[capability]}</strong>
                <span>{freshness?.status ?? "never"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="detail-section">
        <h3>Artifacts</h3>
        {topic.artifacts.length === 0 ? (
          <p className="muted">No artifacts.</p>
        ) : (
          topic.artifacts.map((artifact) => (
            <div className="timeline-row" key={artifact.id}>
              <BookOpen aria-hidden="true" />
              <span>{artifact.title}</span>
              <small>{formatDate(artifact.date)}</small>
            </div>
          ))
        )}
      </div>

      <div className="detail-section">
        <h3>Evidence</h3>
        {topic.evidence.length === 0 ? (
          <p className="muted">No evidence.</p>
        ) : (
          topic.evidence.map((evidence) => (
            <div className="timeline-row" key={evidence.id}>
              <ShieldCheck aria-hidden="true" />
              <span>{evidence.capabilities.map((capability) => CAPABILITY_LABELS[capability]).join(", ")}</span>
              <small>{formatDate(evidence.date)}</small>
            </div>
          ))
        )}
      </div>

      <div className="detail-footer">
        <span>Missing: {missing.length > 0 ? missing : "None"}</span>
        <span>Next recall: {formatDate(topic.next_recall)}</span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
