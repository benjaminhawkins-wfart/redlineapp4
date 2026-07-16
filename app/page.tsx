"use client";

import { useMemo, useRef, useState } from "react";
import * as mammoth from "mammoth/mammoth.browser";
import JSZip from "jszip";

type Part = { value: string; kind: "same" | "added" | "removed" };
type DisplayGroup = { kind: "same"; value: string } | { kind: "change"; removed: string; added: string };

const originalSample = `Payment shall be made within thirty (30) days of receipt of invoice. The Client may terminate this Agreement with 10 days written notice. All work product remains the property of the Consultant until payment is received.`;
const revisedSample = `Payment shall be made within fifteen (15) business days of receipt of a valid invoice. The Client may terminate this Agreement with 30 days' written notice. All work product becomes the property of the Client upon full payment.`;

function tokenize(text: string) {
  return text.match(/\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s\p{L}\p{N}]/gu) || [];
}

function diffWords(before: string, after: string): Part[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const raw: Part[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { raw.push({ value: a[i++], kind: "same" }); j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push({ value: a[i++], kind: "removed" });
    else raw.push({ value: b[j++], kind: "added" });
  }
  while (i < a.length) raw.push({ value: a[i++], kind: "removed" });
  while (j < b.length) raw.push({ value: b[j++], kind: "added" });
  return raw.reduce<Part[]>((out, part) => {
    const last = out[out.length - 1];
    if (last?.kind === part.kind) last.value += part.value;
    else out.push({ ...part });
    return out;
  }, []);
}

function toMarkdown(groups: DisplayGroup[]) {
  return groups.map((group) => group.kind === "same" ? group.value : `${group.removed ? `~~${group.removed}~~` : ""}${group.added ? `**${group.added}**` : ""}`).join("");
}

function wordCount(value: string) {
  return value.match(/[\p{L}\p{N}]+/gu)?.length || 0;
}

function groupChanges(parts: Part[]): DisplayGroup[] {
  const bridgeLimit = 2;
  const groups: DisplayGroup[] = [];
  for (let i = 0; i < parts.length;) {
    if (parts[i].kind === "same") {
      groups.push({ kind: "same", value: parts[i].value });
      i++;
      continue;
    }
    const changeParts: Part[] = [];
    while (i < parts.length) {
      while (i < parts.length && parts[i].kind !== "same") changeParts.push(parts[i++]);
      const bridge = parts[i];
      const hasAnotherChange = i + 1 < parts.length && parts[i + 1].kind !== "same";
      if (bridge?.kind === "same" && hasAnotherChange && wordCount(bridge.value) <= bridgeLimit) {
        changeParts.push(bridge);
        i++;
        continue;
      }
      break;
    }
    const removed = changeParts.filter((p) => p.kind !== "added").map((p) => p.value).join("");
    const added = changeParts.filter((p) => p.kind !== "removed").map((p) => p.value).join("");
    groups.push({ kind: "change", removed, added });
  }
  return groups;
}

function mergeParts(parts: Part[]) {
  return parts.reduce<Part[]>((out, part) => {
    const last = out[out.length - 1];
    if (last?.kind === part.kind) last.value += part.value;
    else if (part.value) out.push(part);
    return out;
  }, []);
}

async function extractTrackedChanges(file: File): Promise<Part[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("Missing Word document content");
  const xml = new DOMParser().parseFromString(await documentFile.async("string"), "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("Invalid Word document");
  const parts: Part[] = [];

  function walk(node: Node, inherited: Part["kind"] = "same") {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const name = el.localName;
    const kind = name === "ins" || name === "moveTo" ? "added" : name === "del" || name === "moveFrom" ? "removed" : inherited;
    if (name === "t" || name === "delText") { parts.push({ kind, value: el.textContent || "" }); return; }
    if (name === "tab") { parts.push({ kind, value: "\t" }); return; }
    if (name === "br" || name === "cr") { parts.push({ kind, value: "\n" }); return; }
    Array.from(el.childNodes).forEach((child) => walk(child, kind));
  }

  const paragraphs = Array.from(xml.getElementsByTagNameNS("*", "p"));
  paragraphs.forEach((paragraph, index) => {
    walk(paragraph);
    if (index < paragraphs.length - 1) parts.push({ kind: "same", value: "\n\n" });
  });
  return mergeParts(parts);
}

function SourcePanel({ label, tone, value, fileName, onChange, onFile }: { label: string; tone: string; value: string; fileName: string; onChange: (v: string) => void; onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <section className="source-card">
    <div className="source-head"><div><span className={`dot ${tone}`} /> <strong>{label}</strong><p>{fileName || "Paste text or select a Word document"}</p></div><button className="file-btn" onClick={() => inputRef.current?.click()} aria-label={`Upload ${label} Word document`}><span>↑</span> Word file</button></div>
    <input ref={inputRef} hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Paste the ${label.toLowerCase()} text here…`} aria-label={`${label} text`} />
    <div className="source-foot"><span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span>{value && <button onClick={() => onChange("")}>Clear</button>}</div>
  </section>;
}

export default function Home() {
  const [mode, setMode] = useState<"compare" | "convert">("compare");
  const [before, setBefore] = useState(originalSample);
  const [after, setAfter] = useState(revisedSample);
  const [beforeFile, setBeforeFile] = useState("");
  const [afterFile, setAfterFile] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [redlineFile, setRedlineFile] = useState("");
  const [convertedParts, setConvertedParts] = useState<Part[]>([]);
  const redlineInputRef = useRef<HTMLInputElement>(null);
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  const activeParts = mode === "compare" ? parts : convertedParts;
  const displayGroups = useMemo(() => mode === "compare" ? groupChanges(parts) : convertedParts.map<DisplayGroup>((part) => part.kind === "same" ? { kind: "same", value: part.value } : { kind: "change", removed: part.kind === "removed" ? part.value : "", added: part.kind === "added" ? part.value : "" }), [mode, parts, convertedParts]);
  const additions = activeParts.filter((p) => p.kind === "added").reduce((n, p) => n + (p.value.match(/[\p{L}\p{N}]+/gu)?.length || 0), 0);
  const removals = activeParts.filter((p) => p.kind === "removed").reduce((n, p) => n + (p.value.match(/[\p{L}\p{N}]+/gu)?.length || 0), 0);

  async function readDoc(file: File, side: "before" | "after") {
    try {
      setError("");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      if (side === "before") { setBefore(result.value.trim()); setBeforeFile(file.name); }
      else { setAfter(result.value.trim()); setAfterFile(file.name); }
    } catch { setError("That Word document couldn’t be read. Please try another .docx file or paste its text."); }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(toMarkdown(displayGroups));
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  async function readRedline(file: File) {
    try {
      setError("");
      setConvertedParts(await extractTrackedChanges(file));
      setRedlineFile(file.name);
    } catch {
      setConvertedParts([]);
      setError("That Word redline couldn’t be read. Please use a .docx file with Track Changes markup.");
    }
  }

  return <main>
    <header><div className="brand"><span className="brand-mark">R</span><span>REDLINE</span></div><div className="privacy"><span>✓</span> Your documents stay in this browser</div></header>
    <section className="hero"><p className="eyebrow">DOCUMENT COMPARISON, SIMPLIFIED</p><h1>See exactly what <em>changed.</em></h1><p>Compare two versions—or convert an existing Word redline directly to Markdown.</p></section>
    <div className="workspace">
      <nav className="mode-tabs" aria-label="Redline tools"><button type="button" className={mode === "compare" ? "active" : ""} onClick={() => { setMode("compare"); setError(""); }}><span>01</span> Compare two versions</button><button type="button" className={mode === "convert" ? "active" : ""} onClick={() => { setMode("convert"); setError(""); }}><span>02</span> Convert Word redline</button></nav>
      {mode === "compare" ? <div className="sources">
        <SourcePanel label="Original" tone="gray" value={before} fileName={beforeFile} onChange={setBefore} onFile={(f) => readDoc(f, "before")} />
        <div className="arrow" aria-hidden="true">→</div>
        <SourcePanel label="Revised" tone="red" value={after} fileName={afterFile} onChange={setAfter} onFile={(f) => readDoc(f, "after")} />
      </div> : <section className="converter-card">
        <div className="converter-copy"><span className="converter-step">WORD TRACK CHANGES → MARKDOWN</span><h2>Upload an existing redline</h2><p>Insertions become <code>**bold**</code>. Deletions become <code>~~strikethrough~~</code>. The file is processed privately in this browser.</p></div>
        <input ref={redlineInputRef} hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && readRedline(e.target.files[0])} />
        <button type="button" className={`redline-upload ${redlineFile ? "loaded" : ""}`} onClick={() => redlineInputRef.current?.click()}><span>{redlineFile ? "✓" : "↑"}</span><strong>{redlineFile || "Choose Word redline"}</strong><small>{redlineFile ? "Click to replace this document" : ".docx with Track Changes"}</small></button>
      </section>}
      {error && <div className="error" role="alert">{error}</div>}
      <section className="result-card">
        <div className="result-head"><div><span className="result-kicker">{mode === "compare" ? "REDLINE" : "CONVERTED REDLINE"}</span><h2>{mode === "compare" ? "Comparison result" : "Markdown preview"}</h2></div><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyMarkdown} disabled={!displayGroups.length}><span>{copied ? "✓" : "⧉"}</span>{copied ? "Copied" : "Copy Markdown"}</button></div>
        <div className="legend"><span className="markup-view">All Markup</span><span><i className="legend-add" /> Inserted</span><span><i className="legend-remove" /> Deleted</span><span className="stats"><b className="plus">+{additions}</b> insertions <b className="minus">−{removals}</b> deletions</span></div>
        <article className="paper word-markup" aria-label="Redline result">{displayGroups.length ? displayGroups.map((group, index) => group.kind === "same" ? <span key={index}>{group.value}</span> : <span className="change-group" key={index}>{group.removed && <span className="change-part removed">{group.removed}</span>}{group.added && <span className="change-part added">{group.added}</span>}</span>) : <span className="empty">{mode === "compare" ? "Your comparison will appear here." : "Upload a tracked Word redline to preview it here."}</span>}</article>
        <div className="markdown-note"><span>MD</span> Added text is copied as <code>**bold**</code> and removed text as <code>~~strikethrough~~</code>.</div>
      </section>
    </div>
    <footer><span>REDLINE</span><p>A private, in-browser comparison tool.</p></footer>
  </main>;
}
