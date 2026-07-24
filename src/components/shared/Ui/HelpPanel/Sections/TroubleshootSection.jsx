/**
 * TroubleshootSection — triage, not a fault register.
 *
 * Almost every user problem is either a real bug (only a report to the dev
 * fixes it) or a usage question (the rest of the Help Register already
 * answers it) — this section sorts the user into one of the two buckets
 * and produces a good handoff for either.
 *
 * Styled entirely from the primitives every tab's controls column uses
 * (primitives.css: .ctrl-block / .ctrl-subtitle / .ctrl-label / .ctrl-input
 * / .ctrl-option / .station / .commit-button) instead of one-off classes,
 * so this reads as a tab controls column rather than a bespoke card. See
 * sections.css for how each piece maps onto those primitives.
 *
 * Props:
 *   contextLabel?   string                 tab section active when Help opened (prefills "Where did it happen?")
 *   mapContext?     string                 loaded map name/version — attached as silent metadata, never asked for
 *   helpLinks       {id,label,hint}[]      Help Register destinations for the "I don't know how…" path
 *   helpCategories  Category[]             narrowing questions grouping helpLinks ids (see shape below)
 *   onNavigate      (id: string) => void   jumps the HelpConsole rail to a section id
 *   repoSlug?       string                 "owner/repo" for the GitHub issue target
 *   discordHandle?  string                 mention prefix for the copied Discord template
 *
 * Category shape:
 *   { id, label, hint, sectionIds: string[] }   sectionIds reference helpLinks ids
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Dropdown } from '../../EntityPanel/EntityPanel.jsx';
import './sections.css';

const FREQUENCY_OPTIONS = [
  { id: 'always',    label: 'Every time' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'once',      label: 'Just once' },
];

const TARGET_OPTIONS = [
  { id: 'github',  label: 'GitHub Issue',    desc: 'Goes straight into the bug tracker.' },
  { id: 'discord', label: 'Mapping Channel', desc: 'Copies a ready-made message for Discord.' },
];

function emptyForm(contextLabel) {
  return {
    where: contextLabel || '',
    goal: '',
    steps: '',
    actual: '',
    frequency: 'always',
    target: 'github',
  };
}

function buildTitle(form) {
  const goal = (form.goal || '').trim();
  if (!goal) return 'Wreckage — unexpected behavior';
  return goal.length > 72 ? `${goal.slice(0, 69)}…` : goal;
}

function frequencyLabel(id) {
  return FREQUENCY_OPTIONS.find(f => f.id === id)?.label || id;
}

function buildIssueBody({ form, contextLabel, mapContext, appVersion, os }) {
  return [
    `**I was trying to:** ${form.goal.trim() || '—'}`,
    '',
    '**Steps:**',
    form.steps.trim() || '—',
    '',
    `**What happened instead:** ${form.actual.trim() || '—'}`,
    '',
    `**Happens:** ${frequencyLabel(form.frequency)}`,
    '',
    '---',
    `*Context: FMT ${appVersion} · ${os} · ${form.where || contextLabel || 'Wreckage'}${mapContext ? ` · ${mapContext}` : ''}*`,
    '',
    '_The log will follow as a file — the folder opens next, please drag it in as an attachment on a comment._',
  ].join('\n');
}

function buildDiscordMessage({ form, contextLabel, mapContext, discordHandle }) {
  const lines = [
    discordHandle,
    `I was trying to: ${form.goal.trim() || '—'}`,
    `Steps: ${form.steps.trim() || '—'}`,
    `What happened instead: ${form.actual.trim() || '—'}`,
    `Happens: ${frequencyLabel(form.frequency)} — Context: ${form.where || contextLabel || 'Wreckage'}${mapContext ? ` (${mapContext})` : ''}`,
    '📎 Log attached.',
  ];
  return lines.join('\n').slice(0, 1900);
}

async function openLogFolder() {
  try {
    const logPath = await window.electronAPI.invoke('get-log-file-path');
    if (!logPath) return;
    const folderPath = logPath.replace(/[\\/][^\\/]*$/, '');
    await window.electronAPI.invoke('open-folder', { folderPath });
  } catch (_) { /* best-effort — a closed folder is not worth blocking the report on */ }
}

export default function TroubleshootSection({
  contextLabel = '',
  mapContext = '',
  helpLinks = [],
  helpCategories = [],
  onNavigate,
  repoSlug = 'ForgeMapToolKit/ForgeMapToolkit',
  discordHandle = '@seraphimnoob',
}) {
  const [path, setPath] = useState(null); // null | 'confused' | 'bug'
  const [confusedCategory, setConfusedCategory] = useState(null);
  const [form, setForm] = useState(() => emptyForm(contextLabel));
  const [submit, setSubmit] = useState({ status: 'idle', message: '', links: [] });

  // Options for the "Where did it happen?" Dropdown. contextLabel may not
  // exactly match a Help Register label (e.g. the host tab's own section
  // naming) — if so it's kept as its own leading option rather than lost.
  const whereOptions = useMemo(() => {
    const known = helpLinks.map(l => ({ value: l.label, label: l.label }));
    if (contextLabel && !known.some(o => o.value === contextLabel)) {
      return [{ value: contextLabel, label: contextLabel }, ...known];
    }
    return known;
  }, [helpLinks, contextLabel]);

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const back = () => {
    setPath(null);
    setConfusedCategory(null);
    setSubmit({ status: 'idle', message: '', links: [] });
  };

  const handleSubmit = useCallback(async () => {
    if (!form.steps.trim() || !form.actual.trim()) {
      setSubmit({
        status: 'error',
        message: '"What steps did you take?" and "What happened instead?" are the core of the report — please fill them in.',
        links: [],
      });
      return;
    }
    setSubmit({ status: 'working', message: '', links: [] });

    let appVersion = '—';
    try { appVersion = await window.electronAPI.invoke('settings-get-version'); } catch (_) {}
    const os = (typeof navigator !== 'undefined' && navigator.userAgent.match(/\(([^)]+)\)/)?.[1]) || 'unknown OS';

    const title = buildTitle(form);

    if (form.target === 'github') {
      const body = buildIssueBody({ form, contextLabel, mapContext, appVersion, os });

      let auth = { connected: false };
      try { auth = await window.electronAPI.invoke('github-auth-status'); } catch (_) {}

      if (auth.connected) {
        let res = { success: false };
        try { res = await window.electronAPI.invoke('github-create-issue', { title, body }); } catch (e) { res = { success: false, error: e.message }; }

        if (res.success) {
          await openLogFolder();
          setSubmit({
            status: 'success',
            message: `Issue #${res.issueNumber} created. The log folder is open — drag the file in as an attachment on a comment.`,
            links: [{ label: `Open issue #${res.issueNumber}`, url: res.issueUrl }],
          });
        } else {
          setSubmit({ status: 'error', message: res.error || 'The issue could not be created.', links: [] });
        }
      } else {
        const url = `https://github.com/${repoSlug}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
        try { await window.electronAPI.invoke('open-external', url); } catch (_) {}
        try { await window.electronAPI.invoke('clipboard-write-text', `${title}\n\n${body}`); } catch (_) {}
        await openLogFolder();
        setSubmit({
          status: 'success',
          message: 'Browser opened — please submit the issue yourself. The full text is also on your clipboard, and the log folder is open.',
          links: [],
        });
      }
    } else {
      const message = buildDiscordMessage({ form, contextLabel, mapContext, discordHandle });
      try { await window.electronAPI.invoke('clipboard-write-text', message); } catch (_) {}
      await openLogFolder();
      setSubmit({
        status: 'success',
        message: 'Message copied — paste it into the mapping channel. The log folder is open, drag the file in too.',
        links: [],
      });
    }
  }, [form, contextLabel, mapContext, repoSlug, discordHandle]);

  return (
    <div className="hs-section hs-tr">
      {path && (
        <div className="hs-tr-back-row">
          <button type="button" className="hs-tr-back-btn" onClick={back}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        </div>
      )}

      {!path && (
        <div className="ctrl-block">
          <div className="ctrl-subtitle ctrl-subtitle--flush">What's going on?</div>
          <div className="hs-tr-body">
            <p className="hs-tr-intro">
              This won't fix anything by itself — it figures out where your problem belongs.
            </p>
            <div className="hs-tr-hero-row">
              <button type="button" className="station hs-tr-hero" onClick={() => setPath('bug')}>
                <span className="ctrl-option-label">Something's Broken</span>
                <span className="ctrl-option-desc">
                  Reproducible misbehavior, a crash, a wrong result — that needs a report to the dev.
                </span>
              </button>
              <button type="button" className="station hs-tr-hero" onClick={() => setPath('confused')}>
                <span className="ctrl-option-label">I Don't Know How To…</span>
                <span className="ctrl-option-desc">
                  The tool is doing what it's supposed to — you're just not sure how. That's what the rest of the Help Register is for.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {path === 'confused' && (
        <div className="hs-tr-bugpath">
          <div className="ctrl-block">
            <div className="ctrl-subtitle ctrl-subtitle--flush">What are you working on?</div>
            <div className="hs-tr-body">
              <div className="hs-tr-tiles">
                {helpCategories.map(cat => (
                  <button
                    type="button"
                    key={cat.id}
                    className="station hs-tr-tile"
                    onClick={() => setConfusedCategory(cat.id)}
                  >
                    <span className="ctrl-option-label">{cat.label}</span>
                    <span className="ctrl-option-desc">{cat.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {confusedCategory && (
            <div className="ctrl-block">
              <div className="ctrl-subtitle ctrl-subtitle--flush">Where to look</div>
              <div className="hs-tr-body">
                <button type="button" className="ctrl-btn-meta" onClick={() => setConfusedCategory(null)}>
                  ← Choose a different area
                </button>
                <div className="hs-tr-tiles">
                  {helpLinks
                    .filter(l => helpCategories.find(c => c.id === confusedCategory)?.sectionIds.includes(l.id))
                    .map(l => (
                      <button type="button" className="station hs-tr-tile" key={l.id} onClick={() => onNavigate?.(l.id)}>
                        <span className="ctrl-option-label">{l.label}</span>
                        <span className="ctrl-option-desc">{l.hint}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {path === 'bug' && (
        <div className="ctrl-block">
          <div className="ctrl-subtitle ctrl-subtitle--flush">Report</div>
          <div className="hs-tr-body">
            <div className="hs-tr-form">
              <div className="ctrl-field">
                <label className="ctrl-label" htmlFor="tr-goal">What were you trying to do?</label>
                <input
                  id="tr-goal"
                  className="ctrl-input ctrl-input--text"
                  type="text"
                  placeholder="e.g. place a wreckage unit with an emitter near the map edge"
                  value={form.goal}
                  onChange={e => setField('goal', e.target.value)}
                />
              </div>

              <div className="ctrl-field">
                <label className="ctrl-label" htmlFor="tr-steps">What steps did you take?</label>
                <textarea
                  id="tr-steps"
                  className="ctrl-input ctrl-input--text hs-tr-textarea"
                  rows={3}
                  placeholder={'1. Loaded the map\n2. Selected an emitter\n3. Clicked Generate'}
                  value={form.steps}
                  onChange={e => setField('steps', e.target.value)}
                />
              </div>

              <div className="ctrl-field">
                <label className="ctrl-label" htmlFor="tr-actual">What happened instead?</label>
                <textarea
                  id="tr-actual"
                  className="ctrl-input ctrl-input--text hs-tr-textarea"
                  rows={2}
                  placeholder="Quote any error message as exactly as you can."
                  value={form.actual}
                  onChange={e => setField('actual', e.target.value)}
                />
              </div>

              <div className="ctrl-field">
                <span className="ctrl-label">Where did it happen?</span>
                <Dropdown
                  options={whereOptions}
                  value={form.where}
                  onChange={val => setField('where', val)}
                  ariaLabel="Where did it happen"
                />
              </div>

              <div className="ctrl-field">
                <span className="ctrl-label">Does this happen every time?</span>
                <div className="ctrl-option-group" style={{ flexDirection: 'row', gap: 'var(--space-sm)' }}>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`ctrl-option${form.frequency === opt.id ? ' active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => setField('frequency', opt.id)}
                    >
                      <div className="ctrl-option-label">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ctrl-field">
                <span className="ctrl-label">Target</span>
                <div className="ctrl-option-group" style={{ flexDirection: 'row', gap: 'var(--space-sm)' }}>
                  {TARGET_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`ctrl-option${form.target === opt.id ? ' active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => setField('target', opt.id)}
                    >
                      <div className="ctrl-option-label">{opt.label}</div>
                      <div className="ctrl-option-desc">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ctrl-mapinfo hs-tr-meta">
                Attached: log file (as attachment) · {form.where || contextLabel || 'Wreckage'}{mapContext ? ` · ${mapContext}` : ''}
              </div>

              <button
                type="button"
                className="commit-button"
                disabled={submit.status === 'working'}
                onClick={handleSubmit}
              >
                <span className="commit-button-label">Create Report</span>
                <span className="commit-button-status">
                  {submit.status === 'working' ? 'Creating…' : 'Ready'}
                </span>
                <span className="commit-button-bloom" aria-hidden="true" />
                <span className="commit-button-line" aria-hidden="true" />
              </button>

              {(submit.status === 'success' || submit.status === 'error') && (
                <div className={`hs-tr-result hs-tr-result--${submit.status}`}>
                  <p>{submit.message}</p>
                  {submit.links.map(l => (
                    <button
                      type="button"
                      key={l.url}
                      className="ctrl-btn-add"
                      onClick={() => window.electronAPI.invoke('open-external', l.url)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
