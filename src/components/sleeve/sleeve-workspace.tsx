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
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { presentPerson, presentRecord, recordKinds, SleeveApiError, sleeveApi } from "./client-api";
import { Modal } from "./modal";
import { RecordSleeve } from "./record-sleeve";
import type { ApiRecordKind, CreateRecordInput, Person, RecordCategory, SessionUser, SleeveRecord, WorkspaceData } from "./types";

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

export function SleeveWorkspace({ data, user, isDemo, onSignOut }: SleeveWorkspaceProps) {
  const [view, setView] = useState<ViewName>("overview");
  const [people, setPeople] = useState(data.people);
  const [activePersonId, setActivePersonId] = useState(data.people[0]?.id ?? "");
  const [personMenu, setPersonMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [shareRecord, setShareRecord] = useState<SleeveRecord | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecordCategory | "All">("All");
  const [toast, setToast] = useState("");
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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
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

  async function createRecord(input: CreateRecordInput, file?: File) {
    if (!activePersonId) throw new SleeveApiError("Add a person before adding a record.", 400);
    if (isDemo) {
      const record = presentLocalRecord(input, Boolean(file));
      setRecords((current) => [record, ...current]);
      setAddRecordOpen(false);
      showToast(`${record.title} was added to this demo.`);
      return;
    }

    let apiRecord = await sleeveApi.createRecord(activePersonId, input);
    let hasSource = false;
    let warning = "";
    if (file) {
      try {
        const uploaded = await sleeveApi.uploadFile(activePersonId, apiRecord.id, file);
        hasSource = true;
        if (file.type !== "application/pdf" && input.kind !== "other") {
          try {
            const extraction = await sleeveApi.extract(activePersonId, apiRecord.id, uploaded.id);
            apiRecord = { ...apiRecord, extraction };
          } catch {
            warning = "The source is secure, but extraction isn’t available right now.";
          }
        }
      } catch (caught) {
        warning = apiErrorMessage(caught, "The record was saved, but its source was not uploaded.");
      }
    }
    const record = presentRecord(apiRecord, hasSource);
    setRecords((current) => [record, ...current]);
    setAddRecordOpen(false);
    showToast(warning || `${record.title} was added.`);
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
          <div className="person-switcher">
            <button className="person-switcher__button" type="button" onClick={() => setPersonMenu((open) => !open)} aria-expanded={personMenu}>
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
            <button className="icon-button" type="button" aria-label="Help"><CircleHelp size={20} strokeWidth={1.6} /></button>
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
      <AddRecordModal open={addRecordOpen} onClose={() => setAddRecordOpen(false)} onCreate={createRecord} isDemo={isDemo} />
      <ShareModal record={shareRecord} personId={activePersonId} onClose={() => setShareRecord(null)} isDemo={isDemo} onCreated={() => showToast("A private share link is ready.")} />
      {toast ? <div className="toast" role="status"><Check size={17} />{toast}</div> : null}
    </div>
  );
}

function Overview({ person, records, reminders, onViewRecords, onAdd, onShare }: { person?: Person; records: SleeveRecord[]; reminders: WorkspaceData["reminders"]; onViewRecords: () => void; onAdd: () => void; onShare: (record: SleeveRecord) => void }) {
  const attention = records.find((record) => record.status === "attention");
  const recent = records.filter((record) => record.id !== attention?.id).slice(0, 3);
  const nextReminder = reminders[0];
  return (
    <div className="view overview-view">
      <header className="view-heading view-heading--overview">
        <div><p className="greeting">Good to see you.</p><h1>{person?.name === "You" ? "Your essentials are in order." : `${person?.name ?? "This person"}’s essentials.`}</h1><p>Find what you need, handle what’s next, and keep the rest quietly protected.</p></div>
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
                <RecordSleeve record={attention} onShare={onShare} />
              </div>
            ) : (
              <div className="all-clear"><ShieldCheck size={24} /><div><h2>Everything looks current.</h2><p>No records need your attention right now.</p></div></div>
            )}
            <section className="recent-section" aria-labelledby="recent-title">
              <div className="section-heading"><div><h2 id="recent-title">Recently ready</h2><p>Open a sleeve to see the details behind it.</p></div><button type="button" onClick={onViewRecords}>See all {records.length}</button></div>
              <div className="record-stack">{recent.map((record) => <RecordSleeve key={record.id} record={record} onShare={onShare} />)}</div>
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

function RecordsView({ records, query, category, onQuery, onCategory, onAdd, onShare }: { records: SleeveRecord[]; query: string; category: RecordCategory | "All"; onQuery: (value: string) => void; onCategory: (value: RecordCategory | "All") => void; onAdd: () => void; onShare: (record: SleeveRecord) => void }) {
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
          <div className="record-stack">{group.records.map((record) => <RecordSleeve key={record.id} record={record} onShare={onShare} />)}</div>
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
  return <section className="empty-records"><span><FileText size={27} /></span><h2>Your first sleeve starts here.</h2><p>Add a record or source image. Sleeve can extract a draft for you to review before anything is saved.</p><button className="button button--primary" type="button" onClick={onAdd}><Plus size={18} />Add first record</button></section>;
}

function EmptyPeople({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-records"><span><Users size={27} /></span><h2>Start with a person.</h2><p>Create a private workspace for yourself or someone you help. Their records stay within that access boundary.</p><button className="button button--primary" type="button" onClick={onAdd}><UserPlus size={18} />Add a person</button></section>;
}

function WorkspaceLoading() {
  return <div className="view" aria-live="polite" aria-busy="true"><section className="empty-records"><span><ShieldCheck size={27} /></span><h2>Opening this private workspace…</h2><p>Loading the records available to this account.</p></section></div>;
}

function AddPersonModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, relationship: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Family member");
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
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t create this private workspace."));
    } finally {
      setBusy(false);
    }
  }
  return <Modal open={open} onClose={onClose} title="Add a person" description="Each person gets a separate private workspace with its own records and access boundary."><form className="modal-form" onSubmit={submit}><label className="field-label" htmlFor="person-name">Name</label><input id="person-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Person’s name" required /><label className="field-label" htmlFor="relationship">Relationship</label><select id="relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)}><option>Family member</option><option>Partner</option><option>Child</option><option>Parent</option><option>Someone I help</option></select><div className="private-note"><LockKeyhole size={17} /><span>Only you can access this workspace unless you explicitly share a record.</span></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button--primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create workspace"}</button></div></form></Modal>;
}

function AddRecordModal({ open, onClose, onCreate, isDemo }: { open: boolean; onClose: () => void; onCreate: (input: CreateRecordInput, file?: File) => Promise<void>; isDemo: boolean }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ApiRecordKind>("passport");
  const [issuer, setIssuer] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onCreate({
        kind,
        title: title.trim(),
        ...(issuer.trim() ? { issuer: issuer.trim() } : {}),
        ...(identifier.trim() ? { identifier: identifier.trim() } : {}),
        ...(issuedOn ? { issuedOn } : {}),
        ...(expiresOn ? { expiresOn } : {}),
      }, file);
      setTitle(""); setIssuer(""); setIdentifier(""); setIssuedOn(""); setExpiresOn(""); setFile(undefined);
    } catch (caught) {
      setError(apiErrorMessage(caught, "We couldn’t add this record."));
    } finally {
      setBusy(false);
    }
  }
  return <Modal open={open} onClose={onClose} title="Add a record" description="Start with the essentials or attach a source. Extracted details always wait for your review." wide><form className="modal-form" onSubmit={submit}><div className="form-split"><div><label className="field-label" htmlFor="record-title">Record name</label><input id="record-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Vision prescription" required /></div><div><label className="field-label" htmlFor="record-kind">Type</label><select id="record-kind" value={kind} onChange={(event) => setKind(event.target.value as ApiRecordKind)}>{recordKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div><div className="form-split"><div><label className="field-label" htmlFor="record-issuer">Issuer</label><input id="record-issuer" value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="Optional" /></div><div><label className="field-label" htmlFor="record-identifier">Document or member number</label><input id="record-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Concealed after saving" autoComplete="off" /></div></div><div className="form-split"><div><label className="field-label" htmlFor="record-issued">Issued on</label><input id="record-issued" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></div><div><label className="field-label" htmlFor="record-expires">Expires on</label><input id="record-expires" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></div></div><label className="upload-field" htmlFor="record-file"><UploadCloud size={25} /><strong>{file?.name || "Choose an image or PDF"}</strong><span>{file ? "Ready to upload privately" : "JPEG, PNG, WebP, or PDF · up to 15 MB"}</span><input id="record-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { setError(""); setFile(event.target.files?.[0]); }} /></label><div className="extraction-note"><Sparkles size={18} /><div><strong>{isDemo ? "Demo extraction" : "Private extraction"}</strong><span>{isDemo ? "No file leaves this browser in the demo." : "Your source is processed in a protected US region. Sleeve proposes fields for your review."}</span></div></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button--primary" type="submit" disabled={busy || !title.trim()}>{busy ? "Saving securely…" : file ? "Upload & review" : "Add record"}</button></div></form></Modal>;
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
  return <Modal open={Boolean(record)} onClose={close} title={createdUrl ? "Private link ready" : `Share ${record?.title ?? "record"}`} description={createdUrl ? "Only the selected record is included. You can revoke access at any time." : "Create limited access to this record without opening the rest of the workspace."}>{createdUrl ? <div className="share-created"><div className="share-created__link"><LockKeyhole size={18} /><span>{isDemo ? "Demo link—not connected" : "Private link created"}</span></div><p><Clock3 size={16} />Expires in {durationLabel}</p>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--secondary" type="button" onClick={close}>Done</button><button className="button button--primary" type="button" disabled={isDemo} onClick={copyLink}>Copy private link</button></div></div> : <div className="share-form"><div className="share-scope"><FileText size={20} /><div><strong>{record?.title}</strong><span>Details {includeSource ? "and private source" : "only"}</span></div><span className="status-chip"><Check size={14} />One record</span></div><label className="field-label" htmlFor="share-duration">Link expires after</label><select id="share-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={1440}>24 hours</option><option value={10080}>7 days</option></select><label className="check-row"><input type="checkbox" checked={includeSource} onChange={(event) => setIncludeSource(event.target.checked)} disabled={!record?.hasSource} /><span><strong>Include source image</strong><small>{record?.hasSource ? "Leave off unless the recipient truly needs it." : "This record does not have a source image."}</small></span></label><div className="private-note"><ShieldCheck size={17} /><span>The link is token-scoped, revocable, and expires automatically. It never reveals other records.</span></div>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="modal-actions"><button className="button button--quiet" type="button" onClick={close} disabled={busy}>Cancel</button><button className="button button--primary" type="button" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create private link"}</button></div></div>}</Modal>;
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
