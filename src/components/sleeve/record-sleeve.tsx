"use client";

import {
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { SleeveRecord } from "./types";

interface RecordSleeveProps {
  record: SleeveRecord;
  onShare: (record: SleeveRecord) => void;
  onDelete: (record: SleeveRecord) => Promise<void>;
}

export function RecordSleeve({ record, onShare, onDelete }: RecordSleeveProps) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(record);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className={`record-sleeve ${open ? "record-sleeve--open" : ""}`}>
      <div className="record-sleeve__turn">
        <div className="record-sleeve__face record-sleeve__front" aria-hidden={open}>
          <button
            className="record-sleeve__trigger"
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            tabIndex={open ? -1 : 0}
          >
            <span className="record-sleeve__meta">
              <span className={`status-dot status-dot--${record.status}`} aria-hidden="true" />
              <span>{record.category}</span>
              <span className="record-sleeve__status">
                {record.status === "attention" ? "Review soon" : "Protected"}
              </span>
            </span>
            <span className="record-sleeve__identity">
              <span>
                <strong>{record.title}</strong>
                <small>{record.subtitle}</small>
              </span>
              <ChevronRight aria-hidden="true" size={20} strokeWidth={1.6} />
            </span>
            <span className="record-sleeve__number">{record.maskedNumber}</span>
            <span className="record-sleeve__foot">
              <span>{record.expiryLabel ?? "No expiry saved"}</span>
              <span>{record.reminderLabel}</span>
            </span>
          </button>
        </div>

        <div className="record-sleeve__face record-sleeve__back" aria-hidden={!open}>
          <div className="record-back__header">
            <div>
              <span>{record.category}</span>
              <strong>{record.title}</strong>
            </div>
            <button
              className="icon-button icon-button--inverse"
              type="button"
              onClick={() => { setOpen(false); setRevealed(false); setConfirmingDelete(false); }}
              tabIndex={open ? 0 : -1}
              aria-label={`Close ${record.title}`}
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="record-back__content">
            <div className="source-preview" aria-label={record.hasSource ? "Source document attached" : "No source document attached"}>
              {record.hasSource ? <ImageIcon size={24} strokeWidth={1.4} aria-hidden="true" /> : <FileText size={24} strokeWidth={1.4} aria-hidden="true" />}
              <span>{record.hasSource ? "Private source" : "Add source"}</span>
              <small>{record.hasSource ? "Open only when needed" : "No image stored"}</small>
            </div>
            <dl className="record-fields">
              {record.fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd className={field.sensitive && !revealed ? "is-masked" : ""}>
                    {field.sensitive && !revealed ? "••••••••" : field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {confirmingDelete ? (
            <div className="record-back__actions record-back__actions--confirm" role="alertdialog" aria-label={`Delete ${record.title}?`}>
              <span>Delete this record and its source for good?</span>
              <button className="back-action" type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} tabIndex={open ? 0 : -1}>
                Keep it
              </button>
              <button className="back-action back-action--danger" type="button" onClick={confirmDelete} disabled={deleting} tabIndex={open ? 0 : -1}>
                <Trash2 size={15} aria-hidden="true" /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : (
            <div className="record-back__actions">
              <button className="back-action" type="button" onClick={() => setRevealed((value) => !value)} tabIndex={open ? 0 : -1}>
                {revealed ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                {revealed ? "Hide details" : "Reveal details"}
              </button>
              <button className="back-action" type="button" onClick={() => setConfirmingDelete(true)} tabIndex={open ? 0 : -1}>
                <Trash2 size={16} aria-hidden="true" /> Delete
              </button>
              <button className="back-action back-action--primary" type="button" onClick={() => onShare(record)} tabIndex={open ? 0 : -1}>
                <Share2 size={17} aria-hidden="true" /> Share
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
