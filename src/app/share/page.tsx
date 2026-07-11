"use client";

import {
  AlertCircle,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Link2Off,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./share.module.css";

type RecordKind =
  | "medical"
  | "insurance"
  | "vision"
  | "passport"
  | "drivers_license"
  | "oci"
  | "green_card"
  | "other";

interface SharedRecord {
  id: string;
  personId: string;
  kind: RecordKind;
  title: string;
  issuer?: string;
  identifier?: string;
  issuedOn?: string;
  expiresOn?: string;
  notes?: string;
  extraction?: {
    fields: Array<{ label: string; value: string }>;
    documentType?: string;
  };
}

interface SharedFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
}

interface SharePayload {
  record: SharedRecord;
  files: SharedFile[];
  expiresAt: string;
}

type PageState = "loading" | "ready" | "missing" | "expired" | "error";
type DownloadState = "idle" | "loading" | "error";

const kindLabels: Record<RecordKind, string> = {
  medical: "Medical",
  insurance: "Insurance",
  vision: "Vision",
  passport: "Passport",
  drivers_license: "Driver license",
  oci: "OCI",
  green_card: "Green card",
  other: "Personal record",
};

function formatDate(value?: string, includeTime = false) {
  if (!value) return undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(undefined, includeTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "File";
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as ({ data?: T; error?: string } | null);
  if (!response.ok || !body?.data) {
    throw new ShareRequestError(body?.error ?? "Unable to open this private share", response.status);
  }
  return body.data;
}

class ShareRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ShareRequestError";
  }
}

export default function SharePage() {
  const tokenRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [share, setShare] = useState<SharePayload | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});

  const expireShare = useCallback(() => {
    tokenRef.current = null;
    requestRef.current?.abort();
    setShare(null);
    setRevealed(false);
    setDownloads({});
    setRemaining(0);
    setPageState("expired");
  }, []);

  const resolveShare = useCallback(async (token: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPageState("loading");

    try {
      const response = await fetch("/api/share/resolve", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      const payload = await readResponse<SharePayload>(response);
      const expiry = new Date(payload.expiresAt).getTime();
      if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        expireShare();
        return;
      }
      setShare(payload);
      setRemaining(expiry - Date.now());
      setPageState("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ShareRequestError && error.status === 404) {
        expireShare();
        return;
      }
      setShare(null);
      setPageState("error");
    }
  }, [expireShare]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    let disposed = false;

    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = fragment.get("token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!token || token.length < 40 || token.length > 100) {
      queueMicrotask(() => {
        if (!disposed) setPageState("missing");
      });
      return () => { disposed = true; };
    }

    tokenRef.current = token;
    queueMicrotask(() => {
      if (!disposed) void resolveShare(token);
    });

    return () => {
      disposed = true;
      requestRef.current?.abort();
    };
  }, [resolveShare]);

  useEffect(() => {
    if (pageState !== "ready" || !share) return;
    const expiry = new Date(share.expiresAt).getTime();
    const update = () => {
      const next = expiry - Date.now();
      if (next <= 0) expireShare();
      else setRemaining(next);
    };
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [expireShare, pageState, share]);

  const retry = () => {
    const token = tokenRef.current;
    if (token) void resolveShare(token);
    else setPageState("expired");
  };

  const downloadFile = async (file: SharedFile) => {
    const token = tokenRef.current;
    if (!token || !share || new Date(share.expiresAt).getTime() <= Date.now()) {
      expireShare();
      return;
    }

    setDownloads((current) => ({ ...current, [file.id]: "loading" }));
    try {
      const response = await fetch("/api/share/file", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, fileId: file.id }),
        referrerPolicy: "no-referrer",
      });
      const { downloadUrl } = await readResponse<{ downloadUrl: string; expiresInSeconds: number }>(response);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = file.fileName;
      anchor.referrerPolicy = "no-referrer";
      anchor.rel = "noreferrer noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setDownloads((current) => ({ ...current, [file.id]: "idle" }));
    } catch (error) {
      if (error instanceof ShareRequestError && error.status === 404 && error.message.includes("share link")) {
        expireShare();
        return;
      }
      setDownloads((current) => ({ ...current, [file.id]: "error" }));
    }
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.wordmark} aria-label="Sleeve">
          <span className={styles.mark} aria-hidden="true"><span /></span>
          <span>Sleeve</span>
        </div>
        <div className={styles.securityLabel}>
          <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>Highly secure sharing</span>
        </div>
      </header>

      <div className={styles.stage}>
        {pageState === "loading" && <LoadingState />}
        {pageState === "missing" && (
          <UnavailableState
            icon="missing"
            title="This link is incomplete"
            message="Ask the sender for a new private share link. For your security, access details are never added to the page address."
          />
        )}
        {pageState === "expired" && (
          <UnavailableState
            icon="expired"
            title="This share is no longer available"
            message="It may have expired or been revoked by the sender. Ask them to create a new private link if you still need access."
          />
        )}
        {pageState === "error" && (
          <UnavailableState
            icon="error"
            title="We couldn’t open this share"
            message="The secure connection didn’t complete. Your access details remain private in this browser tab."
            action={<button className="button button--secondary" type="button" onClick={retry}>Try again</button>}
          />
        )}
        {pageState === "ready" && share && (
          <ShareView
            share={share}
            remaining={remaining}
            revealed={revealed}
            downloads={downloads}
            onToggleReveal={() => setRevealed((current) => !current)}
            onDownload={downloadFile}
          />
        )}
      </div>
    </main>
  );
}

function LoadingState() {
  return (
    <section className={styles.loading} aria-live="polite" aria-busy="true">
      <span className={styles.loadingMark}><ShieldCheck size={23} aria-hidden="true" /></span>
      <div>
        <h1>Opening private share</h1>
        <p>Confirming that this link is active…</p>
      </div>
      <div className={styles.skeleton} aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  );
}

function UnavailableState({
  icon,
  title,
  message,
  action,
}: {
  icon: "missing" | "expired" | "error";
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const Icon = icon === "error" ? AlertCircle : Link2Off;
  return (
    <section className={styles.unavailable} role={icon === "error" ? "alert" : "status"}>
      <span className={styles.unavailableIcon}><Icon size={24} strokeWidth={1.6} aria-hidden="true" /></span>
      <h1>{title}</h1>
      <p>{message}</p>
      {action}
      <div className={styles.unavailableFoot}>
        <ShieldCheck size={16} aria-hidden="true" />
        Sleeve private links are time-limited and revocable.
      </div>
    </section>
  );
}

function ShareView({
  share,
  remaining,
  revealed,
  downloads,
  onToggleReveal,
  onDownload,
}: {
  share: SharePayload;
  remaining: number;
  revealed: boolean;
  downloads: Record<string, DownloadState>;
  onToggleReveal: () => void;
  onDownload: (file: SharedFile) => void;
}) {
  const { record, files } = share;
  const fields = [
    record.issuer ? { label: "Issuer", value: record.issuer, sensitive: false } : null,
    record.identifier ? { label: "Identifier", value: record.identifier, sensitive: true } : null,
    record.issuedOn ? { label: "Issued", value: formatDate(record.issuedOn) ?? "Date unavailable", sensitive: false } : null,
    record.expiresOn ? { label: "Record expires", value: formatDate(record.expiresOn) ?? "Date unavailable", sensitive: false } : null,
    record.notes ? { label: "Notes", value: record.notes, sensitive: true } : null,
    ...(record.extraction?.fields ?? []).map((field) => ({ label: field.label, value: field.value, sensitive: true })),
  ].filter((field): field is { label: string; value: string; sensitive: boolean } => Boolean(field));
  const hasSensitiveFields = fields.some((field) => field.sensitive);
  const exactExpiry = formatDate(share.expiresAt, true);

  return (
    <article className={styles.shareView}>
      <div className={styles.shareIntro}>
        <div>
          <div className={styles.activeStatus}>
            <span aria-hidden="true" />
            Private link active
          </div>
          <h1>A record was shared with you</h1>
          <p>Only the record and source files selected by the sender are available here.</p>
        </div>
        <div className={styles.timer} aria-live="off">
          <Clock3 size={18} strokeWidth={1.7} aria-hidden="true" />
          <span>
            <small>Access ends in</small>
            <strong>{formatRemaining(remaining)}</strong>
          </span>
        </div>
      </div>

      <section className={styles.recordSheet} aria-labelledby="shared-record-title">
        <div className={styles.recordTopline}>
          <span>{kindLabels[record.kind]}</span>
          <span>Shared view</span>
        </div>
        <div className={styles.recordHeading}>
          <div>
            <h2 id="shared-record-title">{record.title}</h2>
            <p>{record.issuer ?? kindLabels[record.kind]}</p>
          </div>
          <span className={styles.recordGlyph} aria-hidden="true"><FileText size={22} strokeWidth={1.45} /></span>
        </div>

        {fields.length > 0 ? (
          <dl className={styles.fields}>
            {fields.map((field, index) => (
              <div key={`${field.label}-${index}`}>
                <dt>{field.label}</dt>
                <dd className={field.sensitive ? styles.sensitiveValue : undefined}>
                  {field.sensitive && !revealed ? <span aria-label={`${field.label} hidden`}>••••••••</span> : field.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.noDetails}>No additional details were included with this record.</p>
        )}

        {hasSensitiveFields && (
          <div className={styles.revealRow}>
            <div>
              <strong>{revealed ? "Sensitive details visible" : "Sensitive details are hidden"}</strong>
              <span>{revealed ? "Hide them again before handing your device to someone else." : "Reveal them only when you’re ready to use them."}</span>
            </div>
            <button className="button button--secondary" type="button" onClick={onToggleReveal} aria-pressed={revealed}>
              {revealed ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
        )}
      </section>

      {files.length > 0 && (
        <section className={styles.files} aria-labelledby="shared-files-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="shared-files-title">Source {files.length === 1 ? "file" : "files"}</h2>
              <p>Downloads are authorized one at a time and expire shortly after opening.</p>
            </div>
            <span>{files.length}</span>
          </div>
          <ul>
            {files.map((file) => {
              const state = downloads[file.id] ?? "idle";
              return (
                <li key={file.id}>
                  <span className={styles.fileIcon} aria-hidden="true"><FileText size={20} strokeWidth={1.5} /></span>
                  <span className={styles.fileName}>
                    <strong>{file.fileName}</strong>
                    <small>{formatSize(file.size)} · {file.contentType === "application/pdf" ? "PDF" : "Image"}</small>
                    {state === "error" && <span role="alert">Download didn’t start. Try again.</span>}
                  </span>
                  <button
                    className={styles.downloadButton}
                    type="button"
                    onClick={() => onDownload(file)}
                    disabled={state === "loading"}
                    aria-label={`Download ${file.fileName}`}
                  >
                    <Download size={17} aria-hidden="true" />
                    {state === "loading" ? "Preparing…" : "Download"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className={styles.shareFooter}>
        <ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <strong>Highly secure, limited access</strong>
          <span>This share ends {exactExpiry ? `on ${exactExpiry}` : "automatically"}. Views and downloads are recorded for the sender.</span>
        </div>
      </footer>
    </article>
  );
}
