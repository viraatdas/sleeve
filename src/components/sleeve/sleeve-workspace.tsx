"use client";

import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileKey,
  FileText,
  FolderOpen,
  Home,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  PenLine,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { presentPerson, presentRecord, recordKinds, SleeveApiError, sleeveApi } from "./client-api";
import { demoExtractionFields } from "./demo-data";
import { Modal } from "./modal";
import { RecordSleeve } from "./record-sleeve";
import { SelectField } from "./select-field";
import type { ApiRecord, ApiRecordKind, CreateRecordInput, Person, RecordCategory, SessionUser, SleeveRecord, UpdateRecordInput, WorkspaceData } from "./types";

type ViewName = "overview" | "records" | "reminders" | "security";

interface SleeveWorkspaceProps {
  data: WorkspaceData;
  user: SessionUser;
  isDemo: boolean;
  onSignOut: () => void;
}

const navItems: Array<{ id: ViewName; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "records", label: "Records", icon: FolderOpen },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
];

const categories: RecordCategory[] = ["Identity", "Health", "Vision", "Insurance", "Immigration"];

interface CreateRecordOptions {
  onStage?: (stage: string) => void;
}

export interface ExtractedField {
  label: string;
  value: string;
  confidence?: number;
}

export interface ScanDraft {
  record: ApiRecord | null;
  personId: string;
  kind: ApiRecordKind;
  fields: ExtractedField[];
  documentType?: string;
  hasSource: boolean;
  failed?: string;
}

interface PendingScan {
  id: string;
  fileName: string;
  preview: string;
  stage: string;
  title: string;
  draft: ScanDraft | null;
}

type ToastTone = "success" | "notice";

const categoryByKind: Record<ApiRecordKind, RecordCategory> = {
  medical: "Health", insurance: "Insurance", vision: "Vision", passport: "Identity",
  drivers_license: "Identity", oci: "Immigration", green_card: "Immigration", other: "Identity",
};

export function SleeveWorkspace({ data, user, isDemo, onSignOut }: SleeveWorkspaceProps) {
  const [view, setView] = useState<ViewName>("overview");
  const [people, setPeople] = useState(data.people);
  const [activePersonId, setActivePersonId] = useState(data.people[0]?.id ?? "");
  const [personMenu, setPersonMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareRecord, setShareRecord] = useState<SleeveRecord | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecordCategory | "All">("All");
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const personMenuRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState(data.records);
  const [loadingPeople, setLoadingPeople] = useState(!isDemo);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    sleeveApi.people()
      .then((nextPeople) => {
        if (!active) return;
        const presented = nextPeople.map(presentPerson);
        setPeople(presented);
        setLoadingRecords(Boolean(presented[0]));
        setActivePersonId((current) => presented.some((person) => person.id === current) ? current : (presented[0]?.id ?? ""));
      })
      .catch((caught) => {
        if (active) setWorkspaceError(apiErrorMessage(caught, "We couldn’t load your private workspaces."));
      })
      .finally(() => { if (active) setLoadingPeople(false); });
    return () => { active = false; };
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
    if (!activePersonId) return;
    let active = true;
    sleeveApi.records(activePersonId)
      .then(async (nextRecords) => {
        const sourceState = await Promise.all(nextRecords.map(async (record) => {
          try {
            const files = await sleeveApi.files(activePersonId, record.id);
            return [record.id, files.some((file) => file.status === "uploaded")] as const;
          } catch {
            return [record.id, false] as const;
          }
        }));
        if (!active) return;
        const sources = new Map(sourceState);
        setRecords(nextRecords.map((record) => presentRecord(record, sources.get(record.id))));
      })
      .catch((caught) => {
        if (active) {
          setRecords([]);
          setWorkspaceError(apiErrorMessage(caught, "We couldn’t load this person’s records."));
        }
      })
      .finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [activePersonId, isDemo]);

  const activePerson = people.find((person) => person.id === activePersonId) ?? people[0];
  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesCategory = category === "All" || record.category === category;
      const matchesQuery = !normalized || `${record.title} ${record.category} ${record.subtitle}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, records]);

  useEffect(() => {
    if (!personMenu) return;
    function dismiss(event: PointerEvent) {
      const target = event.target instanceof Node ? event.target : null;
      if (target && personMenuRef.current?.contains(target)) return;
      setPersonMenu(false);
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPersonMenu(false);
      personMenuRef.current?.querySelector("button")?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onEscape);
    };
  }, [personMenu]);

  function showToast(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4000);
  }

  function navigate(next: ViewName) {
    setView(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPerson(personId: string) {
    if (personId !== activePersonId && !isDemo) {
      setLoadingRecords(true);
      setWorkspaceError("");
    }
    setActivePersonId(personId);
    setPersonMenu(false);
  }

  async function createPerson(name: string, relationship: string) {
    const person = isDemo
      ? { id: `local-${Date.now()}`, name, relationship, initials: initialsFor(name) }
      : presentPerson(await sleeveApi.createPerson(name, relationship));
    setPeople((current) => [...current, person]);
    if (!isDemo) setLoadingRecords(true);
    setActivePersonId(person.id);
    setAddPersonOpen(false);
    showToast(`${name} has a private workspace.`);
  }

  async function createRecord(input: CreateRecordInput, file: File | undefined, options: CreateRecordOptions = {}) {
    if (!activePersonId) throw new SleeveApiError("Add a person before adding a record.", 400);
    if (isDemo) {
      const record = presentLocalRecord(input, Boolean(file));
      setRecords((current) => [record, ...current]);
      setAddRecordOpen(false);
      showToast(`${record.title} was added to this demo.`);
      return;
    }

    options.onStage?.("Saving the record…");
    const apiRecord = await sleeveApi.createRecord(activePersonId, input);
    let hasSource = false;
    let warning = "";
    if (file) {
      try {
        options.onStage?.("Uploading the source privately…");
        await sleeveApi.uploadFile(activePersonId, apiRecord.id, file);
        hasSource = true;
      } catch (caught) {
        warning = apiErrorMessage(caught, "The record was saved, but its source was not uploaded.");
      }
    }
    const record = presentRecord(apiRecord, hasSource);
    setRecords((current) => [record, ...current]);
    setAddRecordOpen(false);
    if (warning) showToast(warning, "notice");
    else showToast(`${record.title} was added.`);
  }

  async function scanRecord(input: CreateRecordInput, file: File, onStage: (stage: string) => void): Promise<ScanDraft> {
    const personId = activePersonId;
    if (!personId) throw new SleeveApiError("Add a person before adding a record.", 400);
    if (isDemo) {
      return { record: null, personId, kind: input.kind, fields: demoExtractionFields(input.kind), documentType: input.kind, hasSource: true };
    }
    onStage("Saving the record…");
    const record = await sleeveApi.createRecord(personId, input);
    let uploadedId = "";
    try {
      onStage("Uploading the source privately…");
      uploadedId = (await sleeveApi.uploadFile(personId, record.id, file)).id;
    } catch (caught) {
      return { record, personId, kind: input.kind, fields: [], hasSource: false, failed: apiErrorMessage(caught, "The source could not be uploaded securely.") };
    }
    try {
      onStage("Reading the document…");
      const extraction = await sleeveApi.extract(personId, record.id, uploadedId);
      return { record, personId, kind: input.kind, fields: extraction.fields, documentType: extraction.documentType, hasSource: true };
    } catch {
      return { record, personId, kind: input.kind, fields: [], hasSource: true, failed: "The source is secure, but extraction isn’t available right now." };
    }
  }

  function startScan(input: CreateRecordInput, file: File) {
    const preview = file.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";
    const id = `scan-${Date.now()}`;
    setPendingScan({ id, fileName: file.name, preview, stage: "Saving the record…", title: input.title, draft: null });
    setAddRecordOpen(false);
    showToast("Reading your document in the background — keep working.");
    void scanRecord(input, file, (stage) => setPendingScan((current) => current && current.id === id ? { ...current, stage } : current))
      .then((draft) => {
        setPendingScan((current) => current && current.id === id ? { ...current, draft, stage: "" } : current);
        if (draft.failed) showToast(draft.failed, "notice");
        else showToast(`${input.title} is ready to review.`);
      })
      .catch((caught) => {
        if (preview) URL.revokeObjectURL?.(preview);
        setPendingScan((current) => current && current.id === id ? null : current);
        showToast(apiErrorMessage(caught, "We couldn’t read that document."), "notice");
      });
  }

  function clearPendingScan() {
    setReviewOpen(false);
    setPendingScan((current) => {
      if (current?.preview) URL.revokeObjectURL?.(current.preview);
      return null;
    });
  }

  async function confirmScan(draft: ScanDraft, title: string, fields: ExtractedField[]) {
    if (isDemo || !draft.record) {
      const record: SleeveRecord = {
        id: `local-record-${Date.now()}`,
        title,
        category: categoryByKind[draft.kind],
        subtitle: "Scanned document",
        maskedNumber: "•••• ••••",
        reminderLabel: "No reminder yet",
        status: "protected",
        hasSource: true,
        fields: fields.length ? fields.map((field) => ({ label: field.label, value: field.value, sensitive: true })) : [{ label: "Details", value: "No details saved yet" }],
      };
      if (draft.personId === activePersonId) setRecords((current) => [record, ...current]);
      clearPendingScan();
      showToast(`${record.title} was added to this demo.`);
      return;
    }

    let apiRecord = draft.record;
    const update: UpdateRecordInput = {};
    if (title !== apiRecord.title) update.title = title;
    if (fields.length) update.extraction = { fields, ...(draft.documentType ? { documentType: draft.documentType } : {}) };
    if (Object.keys(update).length) {
      apiRecord = await sleeveApi.updateRecord(draft.personId, apiRecord.id, update);
    }
    if (draft.personId === activePersonId) {
      const record = presentRecord(apiRecord, draft.hasSource);
      setRecords((current) => [record, ...current]);
    }
    clearPendingScan();
    showToast(`${apiRecord.title} was added with the details you approved.`);
  }

  async function discardScan(draft: ScanDraft) {
    if (!isDemo && draft.record) {
      await sleeveApi.deleteRecord(draft.personId, draft.record.id).catch(() => undefined);
    }
    clearPendingScan();
    showToast("Nothing was saved.", "notice");
  }

  async function removeRecord(record: SleeveRecord) {
    if (!isDemo) {
      try {
        await sleeveApi.deleteRecord(activePersonId, record.id);
      } catch (caught) {
        showToast(apiErrorMessage(caught, "We couldn’t delete this record."), "notice");
        return;
      }
    }
    setRecords((current) => current.filter((item) => item.id !== record.id));
    showToast(`${record.title} was deleted.`);
  }

  const reminders = useMemo(() => isDemo ? data.reminders : records
    .filter((record) => Boolean(record.expiryLabel))
    .map((record) => ({
      id: `record-${record.id}`,
      recordTitle: record.title,
      personName: activePerson?.name ?? "This person",
      timing: record.reminderLabel ?? "Before expiry",
      recipientCount: 1,
      urgent: record.status === "attention",
    })), [activePerson?.name, data.reminders, isDemo, records]);

  return (
    <div className="app-shell">
      <aside className={`rail ${mobileMenu ? "rail--open" : ""}`} aria-label="Primary navigation">
        <div className="rail__brand">
          <span className="wordmark__mark" aria-hidden="true"><span /></span>
          <span>Sleeve</span>
          <button className="icon-button rail__close" type="button" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="rail__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)} type="button" aria-current={view === item.id ? "page" : undefined}>
                <Icon size={19} strokeWidth={1.65} aria-hidden="true" /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="rail__trust">
          <ShieldCheck size={18} aria-hidden="true" />
          <div><strong>Highly secure</strong><span>Private and encrypted</span></div>
        </div>
        <button className="rail__account" type="button" onClick={onSignOut}>
          <span className="avatar avatar--small">{(user.email?.[0] ?? "S").toUpperCase()}</span>
          <span><strong>{user.email ?? "Private account"}</strong><small>Sign out</small></span>
          <LogOut size={17} aria-hidden="true" />
        </button>
      </aside>

      {mobileMenu ? <button className="rail-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} /> : null}

      <div className="app-frame">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="person-switcher" ref={personMenuRef}>
            <button className="person-switcher__button" type="button" onClick={() => setPersonMenu((open) => !open)} aria-expanded={personMenu} aria-label={`Switch person. Currently viewing ${activePerson?.name ?? "no person"}`}>
              <span className="avatar">{activePerson?.initials ?? "—"}</span>
              <span><small>Viewing</small><strong>{activePerson?.name ?? "No person"}</strong></span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {personMenu ? (
              <div className="person-menu" role="menu">
                <p>Private workspaces</p>
                {people.map((person) => (
                  <button key={person.id} type="button" role="menuitem" onClick={() => selectPerson(person.id)}>
                    <span className="avatar avatar--small">{person.initials}</span>
                    <span><strong>{person.name}</strong><small>{person.relationship}</small></span>
                    {person.id === activePersonId ? <Check size={17} aria-label="Selected" /> : null}
                  </button>
                ))}
                <button className="person-menu__add" type="button" role="menuitem" onClick={() => { setPersonMenu(false); setAddPersonOpen(true); }}>
                  <UserPlus size={17} aria-hidden="true" /> Add a person
                </button>
              </div>
            ) : null}
          </div>
          <div className="topbar__right">
            {isDemo ? <span className="demo-pill">Demo workspace</span> : null}
            <button className="icon-button" type="button" onClick={() => setHelpOpen(true)} aria-label="Open help"><CircleHelp size={20} strokeWidth={1.6} /></button>
            <button className="button button--primary topbar__add" type="button" onClick={() => activePerson ? setAddRecordOpen(true) : setAddPersonOpen(true)}><Plus size={18} />{activePerson ? "Add record" : "Add person"}</button>
          </div>
        </header>

        <main className="workspace">
          {workspaceError ? <p className="form-error" role="alert">{workspaceError}</p> : null}
          {loadingPeople || loadingRecords ? <WorkspaceLoading /> : null}
          {!loadingPeople && !loadingRecords && view === "overview" ? (
            <Overview
              person={activePerson}
              records={records}
              reminders={reminders}
              onViewRecords={() => navigate("records")}
              onAdd={() => activePerson ? setAddRecordOpen(true) : setAddPersonOpen(true)}
              onShare={setShareRecord}
              onDelete={removeRecord}
            />
          ) : null}
          {!loadingPeople && !loadingRecords && view === "records" ? (
            <RecordsView
              records={filteredRecords}
              query={query}
              category={category}
              onQuery={setQuery}
              onCategory={setCategory}
              onAdd={() => activePerson ? setAddRecordOpen(true) : setAddPersonOpen(true)}
              onShare={setShareRecord}
              onDelete={removeRecord}
            />
          ) : null}
          {!loadingPeople && !loadingRecords && view === "reminders" ? <RemindersView reminders={reminders} /> : null}
          {!loadingPeople && !loadingRecords && view === "security" ? <SecurityView user={user} onSignOut={onSignOut} /> : null}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)} aria-current={view === item.id ? "page" : undefined}><Icon size={19} strokeWidth={1.7} /><span>{item.label}</span></button>;
        })}
      </nav>

      <AddPersonModal open={addPersonOpen} onClose={() => setAddPersonOpen(false)} onCreate={createPerson} />
      <AddRecordModal open={addRecordOpen} onClose={() => setAddRecordOpen(false)} onCreate={createRecord} onStartScan={startScan} scanPending={Boolean(pendingScan)} isDemo={isDemo} />
      {pendingScan?.draft ? (
        <ReviewScanModal
          key={pendingScan.id}
          open={reviewOpen}
          pending={pendingScan}
          draft={pendingScan.draft}
          onClose={() => setReviewOpen(false)}
          onConfirm={confirmScan}
          onDiscard={discardScan}
        />
      ) : null}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onViewSecurity={() => { setHelpOpen(false); navigate("security"); }} />
      <ShareModal record={shareRecord} personId={activePersonId} onClose={() => setShareRecord(null)} isDemo={isDemo} onCreated={() => showToast("A private share link is ready.")} />
      {pendingScan ? (
        pendingScan.draft ? (
          <button className="scan-pill scan-pill--ready" type="button" onClick={() => setReviewOpen(true)}>
            <Sparkles size={17} aria-hidden="true" />
            <span><strong>{pendingScan.title}</strong><small>{pendingScan.draft.failed ? "Needs a look — open to decide" : "Ready to review"}</small></span>
          </button>
        ) : (
          <div className="scan-pill" role="status">
            <span className="scan-spinner" aria-hidden="true" />
            <span><strong>Reading your document…</strong><small>{pendingScan.stage || "Working privately"}</small></span>
          </div>
        )
      ) : null}
      {toast ? (
        <div className={`toast ${toast.tone === "notice" ? "toast--notice" : ""}`} role="status">
          {toast.tone === "notice" ? <Info size={17} /> : <Check size={17} />}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function Overview({ person, records, reminders, onViewRecords, onAdd, onShare, onDelete }: { person?: Person; records: SleeveRecord[]; reminders: WorkspaceData["reminders"]; onViewRecords: () => void; onAdd: () => void; onShare: (record: SleeveRecord) => void; onDelete: (record: SleeveRecord) => Promise<void> }) {
  const attention = records.find((record) => record.status === "attention");
  const recent = records.filter((record) => record.id !== attention?.id).slice(0, 3);
  const nextReminder = reminders[0];
  return (
    <div className="view overview-view">
      <header className="view-heading view-heading--overview">
        <div><p className="greeting">Good to see you.</p><h1>{person?.relationship === "Me" || person?.name === "You" ? "Your essentials are in order." : `${person?.name ?? "This person"}’s essentials.`}</h1><p>Find what you need, handle what’s next, and keep the rest quietly protected.</p></div>
        <button className="button button--secondary heading-add" type="button" onClick={onAdd}><Plus size={17} />Add record</button>
      </header>

      {!person ? (
        <EmptyPeople onAdd={onAdd} />
      ) : records.length === 0 ? (
        <EmptyRecords onAdd={onAdd} />
      ) : (
        <div className="overview-layout">
          <section className="overview-main" aria-labelledby="attention-title">
            {attention ? (
              <div className="attention-block">
                <div className="section-heading">
                  <div><span className="attention-icon"><Clock3 size={17} /></span><div><h2 id="attention-title">One thing to look at</h2><p>{attention.expiryLabel}. We’ll remind you before it becomes urgent.</p></div></div>
                </div>
                <RecordSleeve record={attention} onShare={onShare} onDelete={onDelete} />
              </div>
            ) : (
              <div className="all-clear"><ShieldCheck size={24} /><div><h2>Everything looks current.</h2><p>No records need your attention right now.</p></div></div>
            )}
            <section className="recent-section" aria-labelledby="recent-title">
              <div className="section-heading"><div><h2 id="recent-title">Recently ready</h2><p>Open a sleeve to see the details behind it.</p></div><button type="button" onClick={onViewRecords}>See all {records.length}</button></div>
              <div className="record-stack">{recent.map((record) => <RecordSleeve key={record.id} record={record} onShare={onShare} onDelete={onDelete} />)}</div>
            </section>
          </section>

          <aside className="overview-aside">
            <section className="care-panel" aria-labelledby="care-title">
              <div className="care-panel__mark"><ShieldCheck size={20} /></div>
              <h2 id="care-title">Quietly protected.</h2>
              <p>Details stay concealed until you reveal them. Source files remain private, and sharing expires automatically.</p>
              <div className="care-list"><span><LockKeyhole size={16} />Encrypted records</span><span><Clock3 size={16} />15-minute shares</span><span><FileKey size={16} />Private source files</span></div>
            </section>
            <section className="next-reminder" aria-labelledby="next-reminder-title">
              <div className="section-heading"><div><h2 id="next-reminder-title">Next reminder</h2><p>{nextReminder?.recordTitle ?? "Nothing scheduled"}</p></div><Bell size={19} /></div>
              {nextReminder ? <><strong>{nextReminder.timing}</strong><span>Sent to {nextReminder.recipientCount} {nextReminder.recipientCount === 1 ? "person" : "people"}</span></> : <span>Add an expiry date to schedule one.</span>}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function RecordsView({ records, query, category, onQuery, onCategory, onAdd, onShare, onDelete }: { records: SleeveRecord[]; query: string; category: RecordCategory | "All"; onQuery: (value: string) => void; onCategory: (value: RecordCategory | "All") => void; onAdd: () => void; onShare: (record: SleeveRecord) => void; onDelete: (record: SleeveRecord) => Promise<void> }) {
  const groups = useMemo(() => categories.map((name) => ({ name, records: records.filter((record) => record.category === name) })).filter((group) => group.records.length), [records]);
  return (
    <div className="view records-view">
      <header className="view-heading"><div><h1>Records</h1><p>Every important detail and source, organized around the person it belongs to.</p></div><button className="button button--primary" type="button" onClick={onAdd}><Plus size={18} />Add record</button></header>
      <div className="records-toolbar">
        <label className="search-field"><Search size={18} /><span className="sr-only">Search records</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search records" /></label>
        <div className="category-tabs" aria-label="Filter by category">{(["All", ...categories] as const).map((name) => <button type="button" key={name} className={category === name ? "is-active" : ""} aria-pressed={category === name} onClick={() => onCategory(name)}>{name}</button>)}</div>
      </div>
      {groups.length ? groups.map((group) => (
        <section className="record-group" key={group.name} aria-labelledby={`group-${group.name}`}>
          <div className="record-group__label"><h2 id={`group-${group.name}`}>{group.name}</h2><span>{group.records.length}</span></div>
          <div className="record-stack">{group.records.map((record) => <RecordSleeve key={record.id} record={record} onShare={onShare} onDelete={onDelete} />)}</div>
        </section>
      )) : <div className="empty-search"><Search size={22} /><h2>No records found</h2><p>Try a different word or category.</p><button type="button" onClick={() => { onQuery(""); onCategory("All"); }}>Clear filters</button></div>}
    </div>
  );
}

function RemindersView({ reminders }: { reminders: WorkspaceData["reminders"] }) {
  return (
    <div className="view reminders-view">
      <header className="view-heading"><div><h1>Reminders</h1><p>Give yourself—and the people you trust—enough time before something needs attention.</p></div><button className="button button--secondary" type="button"><Plus size={18} />New reminder</button></header>
      <section className="reminder-intro"><div className="reminder-intro__icon"><Bell size={22} /></div><div><h2>We’ll keep watch.</h2><p>Sleeve checks the dates you save. Email reminders are on by default as deadlines approach, and you choose who else receives them.</p></div></section>
      <div className="reminder-list">
        {reminders.length ? reminders.map((reminder) => <article key={reminder.id} className="reminder-row"><span className={`reminder-date ${reminder.urgent ? "is-urgent" : ""}`}><Clock3 size={18} /></span><div><strong>{reminder.recordTitle}</strong><span>{reminder.personName} · {reminder.timing}</span></div><div className="reminder-recipients"><Users size={16} />{reminder.recipientCount} {reminder.recipientCount === 1 ? "recipient" : "recipients"}</div><button className="button button--quiet" type="button">Edit</button></article>) : <p className="empty-inline">No reminders yet. Add an expiry date to a record to get started.</p>}
      </div>
      <section className="email-recipients"><div><h2>Reminder recipients</h2><p>Your account email is included. Add trusted people who should know when a deadline is close.</p></div><button className="button button--secondary" type="button"><UserPlus size={17} />Add recipient</button></section>
    </div>
  );
}

function SecurityView({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  return (
    <div className="view security-view">
      <header className="view-heading"><div><h1>Security & settings</h1><p>Clear controls for who can get in, what has been shared, and where your records live.</p></div></header>
      <section className="security-hero"><ShieldCheck size={28} /><div><h2>Highly secure by design.</h2><p>Private by default. Sensitive fields are encrypted, source files are never public, and access is scoped to the person and record you choose.</p></div><span>Protected</span></section>
      <div className="settings-sections">
        <section><div className="settings-section__title"><KeyRound size={20} /><div><h2>Sign-in</h2><p>No reusable password to steal or forget.</p></div></div><div className="setting-row"><div><strong>Email one-time codes</strong><span>Codes expire after 10 minutes and work once.</span></div><span className="status-chip"><Check size={14} />On</span></div><div className="setting-row"><div><strong>Account email</strong><span>{user.email ?? "Available after sign-in"}</span></div><button type="button">Change</button></div></section>
        <section><div className="settings-section__title"><Clock3 size={20} /><div><h2>Sharing</h2><p>Short-lived access with a clear end.</p></div></div><div className="setting-row"><div><strong>Default share duration</strong><span>New share links expire automatically.</span></div><button type="button">15 minutes</button></div><div className="setting-row"><div><strong>Active share links</strong><span>No active links in this preview.</span></div><button type="button">Review</button></div></section>
        <section><div className="settings-section__title"><FileKey size={20} /><div><h2>Data & sessions</h2><p>Review access or leave this device.</p></div></div><div className="setting-row"><div><strong>This session</strong><span>Signed in on this browser.</span></div><button type="button" onClick={onSignOut}>Sign out</button></div></section>
      </div>
    </div>
  );
}

function EmptyRecords({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-records"><span><FileText size={27} /></span><h2>Your first sleeve starts here.</h2><p>Scan a document and Sleeve drafts the details for your review, or fill them out yourself.</p><button className="button button--primary" type="button" onClick={onAdd}><Plus size={18} />Add first record</button></section>;
}

function EmptyPeople({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-records"><span><Users size={27} /></span><h2>Start with a person.</h2><p>Create a private workspace for yourself or someone you help. Their records stay within that access boundary.</p><button className="button button--primary" type="button" onClick={onAdd}><UserPlus size={18} />Add a person</button></section>;
}

function WorkspaceLoading() {
  return <div className="view" aria-live="polite" aria-busy="true"><section className="empty-records"><span><ShieldCheck size={27} /></span><h2>Opening this private workspace…</h2><p>Loading the records available to this account.</p></section></div>;
}

function AddPersonModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, relationship: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Me");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(name.trim(), relationship);
      setName("");
      setRelationship("Me");
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t create this private workspace."));
    } finally {
      setBusy(false);
    }
  }
  return <Modal open={open} onClose={onClose} title="Add a person" description="Each person gets a separate private workspace with its own records and access boundary."><form className="modal-form" onSubmit={submit}><label className="field-label" htmlFor="person-name">Name</label><input id="person-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={relationship === "Me" ? "Your name" : "Person’s name"} required /><label className="field-label" htmlFor="relationship">Relationship</label><SelectField id="relationship" label="Relationship" value={relationship} onChange={setRelationship} icon={UserRound} options={relationshipOptions} /><p className="field-hint">{relationship === "Me" ? "Your own private records and documents." : `A private workspace for ${relationship.toLowerCase()}.`}</p><div className="private-note"><LockKeyhole size={17} /><span>Only you can access this workspace unless you explicitly share a record.</span></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button--primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create workspace"}</button></div></form></Modal>;
}

const relationshipOptions = ["Me", "Family member", "Partner", "Child", "Parent", "Someone I help"].map((value) => ({ value, label: value }));

type AddRecordMode = "scan" | "manual";

const kindOptions = recordKinds.map(({ value, label }) => ({ value, label }));
const scanKindOptions = kindOptions.filter((option) => option.value !== "other");
const kindLabels = new Map(recordKinds.map(({ value, label }) => [value, label]));
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function documentTypeLabel(type: string) {
  return kindLabels.get(type as ApiRecordKind)?.toLowerCase() ?? type.replace(/_/g, " ").toLowerCase();
}

interface AddRecordModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateRecordInput, file: File | undefined, options: CreateRecordOptions) => Promise<void>;
  onStartScan: (input: CreateRecordInput, file: File) => void;
  scanPending: boolean;
  isDemo: boolean;
}

function AddRecordModal({ open, onClose, onCreate, onStartScan, scanPending, isDemo }: AddRecordModalProps) {
  const [mode, setMode] = useState<AddRecordMode>("scan");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ApiRecordKind>("passport");
  const [issuer, setIssuer] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  const scanning = mode === "scan";
  const kindLabel = kindLabels.get(kind) ?? "Record";
  const previewRef = useRef("");

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL?.(previewRef.current);
  }, []);

  function updateFile(next: File | undefined) {
    if (previewRef.current) URL.revokeObjectURL?.(previewRef.current);
    previewRef.current = next && next.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(next) : "";
    setPreview(previewRef.current);
    setFile(next);
  }

  function switchMode(next: AddRecordMode) {
    if (busy || next === mode) return;
    setMode(next);
    setError("");
    if (next === "scan") {
      if (kind === "other") setKind("passport");
      if (file && !IMAGE_TYPES.includes(file.type)) updateFile(undefined);
    }
  }

  function acceptFile(next: File | undefined | null) {
    setError("");
    if (!next) return;
    const allowed = scanning ? IMAGE_TYPES : [...IMAGE_TYPES, "application/pdf"];
    if (!allowed.includes(next.type)) {
      setError(scanning ? "Choose a JPEG, PNG, or WebP image so Sleeve can read it." : "Choose a JPEG, PNG, WebP, or PDF file.");
      return;
    }
    if (next.size > MAX_FILE_BYTES) {
      setError("Files can be up to 15 MB.");
      return;
    }
    updateFile(next);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function resetForm() {
    setTitle(""); setIssuer(""); setIdentifier(""); setIssuedOn(""); setExpiresOn("");
    updateFile(undefined); setError("");
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectiveTitle = scanning ? (title.trim() || kindLabel) : title.trim();
    if (!effectiveTitle || (scanning && !file)) return;
    if (scanning && file) {
      if (scanPending) return;
      onStartScan({ kind, title: effectiveTitle }, file);
      resetForm();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate({
        kind,
        title: effectiveTitle,
        ...(issuer.trim() ? { issuer: issuer.trim() } : {}),
        ...(identifier.trim() ? { identifier: identifier.trim() } : {}),
        ...(issuedOn ? { issuedOn } : {}),
        ...(expiresOn ? { expiresOn } : {}),
      }, file, { onStage: setStage });
      resetForm();
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t add this record."));
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const canSubmit = scanning ? Boolean(file) && !scanPending : Boolean(title.trim());
  const submitLabel = busy ? (stage || "Saving securely…") : scanning ? "Extract & review" : file ? "Save & upload" : "Save record";

  const dropzone = (
    <label
      className={`upload-field ${file ? "upload-field--filled" : ""} ${dragging ? "is-dragover" : ""}`}
      htmlFor="record-file"
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {file ? (
        <>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img className="upload-field__thumb" src={preview} alt="" />
          ) : (
            <span className="upload-field__thumb upload-field__thumb--doc"><FileText size={20} strokeWidth={1.5} aria-hidden="true" /></span>
          )}
          <span className="upload-field__info">
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)} · Stays private to this workspace</span>
          </span>
          <button
            className="upload-field__remove"
            type="button"
            disabled={busy}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); updateFile(undefined); }}
          >
            Remove
          </button>
        </>
      ) : (
        <>
          <UploadCloud size={25} aria-hidden="true" />
          <strong>{scanning ? "Drop an image here, or browse" : "Attach an image or PDF"}</strong>
          <span>{scanning ? "JPEG, PNG, or WebP · up to 15 MB" : "Optional · JPEG, PNG, WebP, or PDF · up to 15 MB"}</span>
        </>
      )}
      <input
        key={file ? file.name : "empty"}
        id="record-file"
        type="file"
        accept={scanning ? IMAGE_TYPES.join(",") : [...IMAGE_TYPES, "application/pdf"].join(",")}
        disabled={busy}
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
    </label>
  );

  return (
    <Modal open={open} onClose={handleClose} title="Add a record" description="Scan a source document, or enter the details yourself. Nothing is shared until you choose to." wide>
      <form className="modal-form" onSubmit={submit}>
        <div className="mode-switch" role="radiogroup" aria-label="How would you like to add it?">
          <button
            type="button"
            role="radio"
            aria-checked={scanning}
            tabIndex={scanning ? 0 : -1}
            onClick={() => switchMode("scan")}
            onKeyDown={(event) => { if (event.key.startsWith("Arrow")) { event.preventDefault(); switchMode("manual"); } }}
          >
            <span className="mode-switch__icon"><ScanLine size={18} strokeWidth={1.8} aria-hidden="true" /></span>
            <span><strong>Scan a document</strong><small>Upload a photo and Sleeve drafts the details.</small></span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!scanning}
            tabIndex={scanning ? -1 : 0}
            onClick={() => switchMode("manual")}
            onKeyDown={(event) => { if (event.key.startsWith("Arrow")) { event.preventDefault(); switchMode("scan"); } }}
          >
            <span className="mode-switch__icon"><PenLine size={18} strokeWidth={1.8} aria-hidden="true" /></span>
            <span><strong>Fill it out</strong><small>Type the details. Attach a source anytime.</small></span>
          </button>
        </div>

        {scanning ? (
          <>
            {dropzone}
            <div className="form-split">
              <div>
                <label className="field-label" htmlFor="record-kind">Document type</label>
                <SelectField id="record-kind" label="Document type" value={kind} onChange={(value) => setKind(value as ApiRecordKind)} icon={FileKey} options={scanKindOptions} disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="record-title">Record name <span className="field-optional">optional</span></label>
                <input id="record-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kindLabel} disabled={busy} />
              </div>
            </div>
            <div className="extraction-note">
              <Sparkles size={18} aria-hidden="true" />
              <div>
                <strong>{isDemo ? "Demo extraction" : "Reads in the background"}</strong>
                <span>{isDemo ? "No file leaves this browser in the demo." : "Your source is processed in a protected US region while you keep working. Nothing is saved without your review."}</span>
              </div>
            </div>
            {scanPending ? <p className="field-help" role="status">A document is already being read. When it finishes you can review it, then scan another.</p> : null}
          </>
        ) : (
          <>
            <div className="form-split">
              <div>
                <label className="field-label" htmlFor="record-title">Record name</label>
                <input id="record-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Vision prescription" required disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="record-kind">Type</label>
                <SelectField id="record-kind" label="Type" value={kind} onChange={(value) => setKind(value as ApiRecordKind)} icon={FileKey} options={kindOptions} disabled={busy} />
              </div>
            </div>
            <div className="form-split">
              <div>
                <label className="field-label" htmlFor="record-issuer">Issuer <span className="field-optional">optional</span></label>
                <input id="record-issuer" value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="e.g. U.S. Department of State" disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="record-identifier">Document or member number <span className="field-optional">optional</span></label>
                <input id="record-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Concealed after saving" autoComplete="off" disabled={busy} />
              </div>
            </div>
            <div className="form-split">
              <div>
                <label className="field-label" htmlFor="record-issued">Issued on</label>
                <input id="record-issued" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="record-expires">Expires on</label>
                <input id="record-expires" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} disabled={busy} />
              </div>
            </div>
            {dropzone}
            <div className="private-note">
              <LockKeyhole size={17} aria-hidden="true" />
              <span>Sensitive values are encrypted and concealed until you reveal them.</span>
            </div>
          </>
        )}

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button--primary" type="submit" disabled={busy || !canSubmit} aria-live="polite">{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

interface ReviewScanModalProps {
  open: boolean;
  pending: PendingScan;
  draft: ScanDraft;
  onClose: () => void;
  onConfirm: (draft: ScanDraft, title: string, fields: ExtractedField[]) => Promise<void>;
  onDiscard: (draft: ScanDraft) => Promise<void>;
}

function ReviewScanModal({ open, pending, draft, onClose, onConfirm, onDiscard }: ReviewScanModalProps) {
  const [title, setTitle] = useState(pending.title);
  const [fields, setFields] = useState<ExtractedField[]>(draft.fields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kindLabel = kindLabels.get(draft.kind) ?? "Record";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalTitle = title.trim() || kindLabel;
    const keptFields = fields
      .map((field) => ({ ...field, value: field.value.trim() }))
      .filter((field) => field.value);
    setBusy(true);
    setError("");
    try {
      await onConfirm(draft, finalTitle, keptFields);
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t save this record."));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await onDiscard(draft);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title="Review before saving"
      description="Check what Sleeve read from your document. Close this to decide later — nothing is saved until you approve it."
      wide
    >
      <form className="modal-form" onSubmit={save}>
        <div className="review-source">
          {pending.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img className="review-source__thumb" src={pending.preview} alt="" />
          ) : (
            <span className="review-source__thumb review-source__thumb--doc"><FileText size={18} strokeWidth={1.6} aria-hidden="true" /></span>
          )}
          <span className="review-source__info">
            <strong>{pending.fileName}</strong>
            <span>{draft.failed ? "Uploaded for this record" : `Read as ${documentTypeLabel(draft.documentType ?? draft.kind)}`}</span>
          </span>
          <span className="status-chip"><Check size={14} aria-hidden="true" />Private</span>
        </div>

        {draft.failed ? <p className="form-error" role="alert">{draft.failed}</p> : null}

        <label className="field-label" htmlFor="review-title">Record name</label>
        <input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kindLabel} disabled={busy} />

        {fields.length ? (
          <>
            <p className="review-fields-label">Extracted details <span>{fields.length} {fields.length === 1 ? "field" : "fields"} proposed</span></p>
            <div className="review-fields">
              {fields.map((field, index) => (
                <div className="review-field" key={`${field.label}-${index}`}>
                  <label htmlFor={`review-field-${index}`}>
                    {field.label}
                    {typeof field.confidence === "number" && field.confidence < 0.6 ? <span className="review-flag">Double-check</span> : null}
                  </label>
                  <div className="review-field__row">
                    <input
                      id={`review-field-${index}`}
                      value={field.value}
                      onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, value: event.target.value } : item))}
                      autoComplete="off"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="review-field__remove"
                      aria-label={`Remove ${field.label}`}
                      disabled={busy}
                      onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="field-help">
            {draft.failed
              ? `You can keep the record${draft.hasSource ? " and its private source" : ""} and add details later, or discard it.`
              : "Sleeve couldn’t propose fields from this image. You can save the record with its source and add details later."}
          </p>
        )}

        <div className="private-note"><LockKeyhole size={17} aria-hidden="true" /><span>Nothing is added until you save. Saved values stay concealed until you reveal them.</span></div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button className="button button--quiet" type="button" onClick={discard} disabled={busy}>Discard</button>
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? "Saving…" : draft.failed && !fields.length ? "Keep record" : "Save record"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ShareModal({ record, personId, onClose, isDemo, onCreated }: { record: SleeveRecord | null; personId: string; onClose: () => void; isDemo: boolean; onCreated: () => void }) {
  const [duration, setDuration] = useState(15);
  const [includeSource, setIncludeSource] = useState(false);
  const [createdUrl, setCreatedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function close() { setCreatedUrl(""); setDuration(15); setIncludeSource(false); setError(""); onClose(); }
  async function create() {
    if (!record || !personId) return;
    setBusy(true);
    setError("");
    try {
      if (isDemo) {
        setCreatedUrl("demo");
      } else {
        const share = await sleeveApi.createShare(personId, record.id, duration, includeSource);
        setCreatedUrl(share.url);
      }
      onCreated();
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t create this private link."));
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    if (!createdUrl || isDemo) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      onCreated();
    } catch {
      setError("Your browser blocked copying. Close this link and create a new one when clipboard access is available.");
    }
  }
  const durationLabel = duration === 15 ? "15 minutes" : duration === 60 ? "1 hour" : duration === 1440 ? "24 hours" : "7 days";
  return <Modal open={Boolean(record)} onClose={close} title={createdUrl ? "Private link ready" : `Share ${record?.title ?? "record"}`} description={createdUrl ? "Only the selected record is included. You can revoke access at any time." : "Create limited access to this record without opening the rest of the workspace."}>{createdUrl ? <div className="share-created"><div className="share-created__link"><LockKeyhole size={18} /><span>{isDemo ? "Demo link—not connected" : "Private link created"}</span></div><p><Clock3 size={16} />Expires in {durationLabel}</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--secondary" type="button" onClick={close}>Done</button><button className="button button--primary" type="button" disabled={isDemo} onClick={copyLink}>Copy private link</button></div></div> : <div className="share-form"><div className="share-scope"><FileText size={20} /><div><strong>{record?.title}</strong><span>Details {includeSource ? "and private source" : "only"}</span></div><span className="status-chip"><Check size={14} />One record</span></div><label className="field-label" htmlFor="share-duration">Link expires after</label><SelectField id="share-duration" label="Link expires after" value={String(duration)} onChange={(value) => setDuration(Number(value))} icon={Clock3} options={durationOptions} /><label className="check-row"><input type="checkbox" checked={includeSource} onChange={(event) => setIncludeSource(event.target.checked)} disabled={!record?.hasSource} /><span><strong>Include source image</strong><small>{record?.hasSource ? "Leave off unless the recipient truly needs it." : "This record does not have a source image."}</small></span></label><div className="private-note"><ShieldCheck size={17} /><span>The link is token-scoped, revocable, and expires automatically. It never reveals other records.</span></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--quiet" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button button--primary" type="button" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create private link"}</button></div></div>}</Modal>;
}

const durationOptions = [
  { value: "15", label: "15 minutes", hint: "Recommended" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "24 hours" },
  { value: "10080", label: "7 days" },
];

function HelpModal({ open, onClose, onViewSecurity }: { open: boolean; onClose: () => void; onViewSecurity: () => void }) {
  return <Modal open={open} onClose={onClose} title="How Sleeve works" description="A quick guide to keeping important information organized and private."><div className="help-content"><div className="help-list"><div className="help-item"><span><UserRound size={18} /></span><div><strong>Start with a person</strong><p>Choose “Me” for your own records, or add someone whose information you manage.</p></div></div><div className="help-item"><span><FileKey size={18} /></span><div><strong>Add the essentials</strong><p>Save key details and attach a private source image or PDF when you have one.</p></div></div><div className="help-item"><span><ShieldCheck size={18} /></span><div><strong>Share only what’s needed</strong><p>Private links include one record, expire after 15 minutes by default, and can be revoked.</p></div></div></div><div className="modal-actions"><button className="button button--quiet" type="button" onClick={onClose}>Close</button><button className="button button--secondary" type="button" onClick={onViewSecurity}><ShieldCheck size={17} />View security</button></div></div></Modal>;
}

function apiErrorMessage(caught: unknown, fallback: string) {
  return caught instanceof SleeveApiError ? caught.message : fallback;
}

function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "—";
}

function presentLocalRecord(input: CreateRecordInput, hasSource: boolean): SleeveRecord {
  const categoryByKind: Record<ApiRecordKind, RecordCategory> = {
    medical: "Health", insurance: "Insurance", vision: "Vision", passport: "Identity",
    drivers_license: "Identity", oci: "Immigration", green_card: "Immigration", other: "Identity",
  };
  const fields: SleeveRecord["fields"] = [];
  if (input.issuer) fields.push({ label: "Issuer", value: input.issuer });
  if (input.identifier) fields.push({ label: "Identifier", value: input.identifier, sensitive: true });
  if (input.expiresOn) fields.push({ label: "Expires", value: input.expiresOn });
  if (!fields.length) fields.push({ label: "Details", value: "Demo value", sensitive: true });
  return {
    id: `local-record-${Date.now()}`,
    title: input.title,
    category: categoryByKind[input.kind],
    subtitle: input.issuer || "Local demo record",
    maskedNumber: input.identifier ? "•••• ••••" : "No number saved",
    expiryLabel: input.expiresOn ? `Expires ${input.expiresOn}` : undefined,
    reminderLabel: input.expiresOn ? "Reminder set" : "No reminder yet",
    status: "protected",
    hasSource,
    fields,
  };
}
