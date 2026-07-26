import React, { useState, useEffect, useRef } from 'react';
import Anser from 'anser';
import { getAllHistory } from '../../../../../utils/ScmapHistoryTracker.js';
import {
  createSessionId,
  listSessions,
  loadSession,
  saveSession,
} from '../../../../../utils/CliSessionStore.js';
// ^ NOTE: adjust the relative depth on both imports if CliTerminal.jsx
//   doesn't sit exactly one folder below where History.jsx resolves the
//   ScmapHistoryTracker import from.
import './CliTerminal.css';

/**
 * CLI Terminal — an actual terminal, not a form.
 *
 * Mirrors electron/cli.js's own REPL: same banner, same `fmt ›` commands
 * (unpack/repack/resize/preview + /help), dispatched through the exact same
 * code via the 'cli-exec' IPC bridge (electron/modules/cli-runner.js) — this
 * tab owns no command logic of its own.
 *
 * Layout follows the Claude Code pattern:
 *   - mountain glyph acts as the "first message" at the top of the scrolling
 *     log (not a fixed overlay) — it scrolls out of view naturally as more
 *     output is appended, and scrolls back into view if the user scrolls up
 *   - a short "recent activity" summary (from ScmapHistoryTracker) sits
 *     right under it, tab name + relative time only, no details
 *   - the input lives in a fixed footer below a hairline divider, prompt is
 *     a plain `>` instead of a full cmd-style prompt line
 *   - `/session-list` drops into a picker (↑/↓ to browse, Enter to open,
 *     Esc to cancel) over saved past sessions, persisted via
 *     CliSessionStore.js (JSON in appData, IPC same pattern as history)
 */

const LINE_CLS = {
  stdout:  'cli-line--stdout',
  error:   'cli-line--error',
  echo:    'cli-line--echo',
  muted:   'cli-line--muted',
  banner:  'cli-line--banner',   // ← wieder eigenständig, nicht an accent gekoppelt
  ok:      'cli-line--ok',
  warn:    'cli-line--warn',
  heading: 'cli-line--heading',
  flag:    'cli-line--flag',
  accent:  'cli-line--accent',
};

// Mountain glyph — the mascot. Each line is a uniform 45 chars.
const LOGO_LINES = [
  '               ██████████████                ',
  '           ██████         ███████            ',
  '         ████        ██        ████          ',
  '       ███          █████         ███        ',
  '      ██          ████████          ██       ',
  '     ██          ███████████     █   ██      ',
  '         ████  ██████████████  █████         ',
  '       █████████████████     █████████       ',
  '     ███████ ██████████   ██████████████     ',
  '    ██████████████████  █████████████████    ',
  '  ███████████████████ █████████████████████  ',
  '█████████████████████████████████████████████',
];

// Kept in sync with History.jsx's TAB_LABELS — duplicated here since that
// map isn't exported. If you add a tab there, add it here too.
const TAB_LABELS = {
  wreckages:          'Wreckages',
  props:              'Props',
  emitter:            'Emitter',
  customprops:        'Custom Props',
  treemap:            'TreeMap',
  rockerosion:        'Rock Erosion',
  stars:              'Stars',
  'skybox-generator': 'Skybox',
  scmaptool:          'SCMAP Tool',
  previewimage:       'Preview Image',
  'history-editor':   'History',
};

const RECENT_ACTIVITY_LIMIT = 5;

function timeAgo(iso) {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `${Math.floor(day / 7)}w ago`;
}

function buildBannerLines() {
  return [
    ...LOGO_LINES.map(text => ({ type: 'banner', text })),
    { type: 'stdout', text: '' },
    { type: 'stdout', text: '  Type /help for available commands.' },
    { type: 'stdout', text: '' },
  ];
}

async function buildRecentActivityLines() {
  let entries = [];
  try {
    entries = await getAllHistory();
  } catch (e) {
    // Surface the failure in-app instead of only logging it — a silent
    // empty return here is exactly what made this invisible before.
    console.warn('[CliTerminal] Failed to load recent activity:', e);
    return [
      { type: 'error', text: `  ⚠ Recent activity unavailable: ${e.message || e}` },
      { type: 'stdout', text: '' },
    ];
  }
  if (!entries.length) {
    return [
      { type: 'muted', text: '  Recent activity: none yet' },
      { type: 'stdout', text: '' },
    ];
  }

  const recent = entries.slice(0, RECENT_ACTIVITY_LIMIT);
  return [
    { type: 'muted', text: '  Recent activity:' },
    ...recent.map(e => ({
      type: 'muted',
      text: `    ${TAB_LABELS[e.tabId] || e.tabId} · ${timeAgo(e.timestamp)}`,
    })),
    { type: 'stdout', text: '' },
  ];
}

async function buildWelcomeLines(mapsFolder) {
  const banner = buildBannerLines(mapsFolder);
  const activity = await buildRecentActivityLines();
  return [...banner, ...activity];
}

const CliTerminalTab = ({ settings }) => {
  const [version, setVersion] = useState('0.0.0');
  const [lines,   setLines]   = useState([]);
  const [input,   setInput]   = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);

  // Session persistence
  const sessionIdRef    = useRef(createSessionId());
  const sessionStartRef = useRef(new Date().toISOString());
  const [pickerSessions, setPickerSessions] = useState(null); // null = not in picker mode
  const [pickerIndex,    setPickerIndex]    = useState(0);

  const logRef   = useRef(null);
  const inputRef = useRef(null);

  // App version for the banner
  useEffect(() => {
    window.electronAPI.invoke('settings-get-version').then(v => setVersion(v || '0.0.0'));
  }, []);

  // (Re)print the welcome screen (logo + recent activity) once we know the version
  useEffect(() => {
    let cancelled = false;
    buildWelcomeLines(settings?.mapsFolder).then(welcome => {
      if (!cancelled) setLines(welcome);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Streaming output from the main process (long-running commands like `preview`)
  useEffect(() => {
    const unsub = window.electronAPI.on('cli-output', msg => {
      setLines(prev => [...prev, msg]);
    });
    return unsub;
  }, []);

  // Keep scrolled to bottom on new output/input — but only if the user was
  // already at (or near) the bottom, so scrolling up to revisit the logo
  // doesn't get yanked back down on the next line.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lines, input]);

  // Autosave the session after every change to `lines` — not just on clean
  // shutdown, so a crash doesn't lose it. Skip the bare welcome screen so we
  // don't spam the store with empty sessions nobody ever typed into.
  useEffect(() => {
    if (lines.length <= 1) return;
    saveSession(sessionIdRef.current, lines, sessionStartRef.current);
  }, [lines]);

  // Best-effort flush on close/restart, in addition to the per-change autosave above.
  useEffect(() => {
    const flush = () => saveSession(sessionIdRef.current, lines, sessionStartRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [lines]);

  const addLine = (type, text) => setLines(prev => [...prev, { type, text }]);
  const focusInput = () => inputRef.current?.focus();

  const closePicker = () => { setPickerSessions(null); setPickerIndex(0); };

  const openSessionPicker = async () => {
    const sessions = await listSessions();
    if (!sessions.length) {
      addLine('muted', '  No saved sessions yet.');
      return;
    }
    setPickerSessions(sessions);
    setPickerIndex(0);
  };

  const openSelectedSession = async () => {
    const target = pickerSessions?.[pickerIndex];
    closePicker();
    if (!target) return;

    const full = await loadSession(target.id);
    if (!full) {
      addLine('error', '  ✖ Could not load that session.');
      return;
    }

    addLine('info', `  ── Loaded session from ${timeAgo(full.endedAt)} (${full.lines.length} lines) ──`);
    setLines(prev => [...prev, ...full.lines]);
    // Continue under a fresh session id so this doesn't silently overwrite
    // the one we just loaded from.
    sessionIdRef.current = createSessionId();
    sessionStartRef.current = new Date().toISOString();
  };

  const runCommand = async (raw) => {
    addLine('echo', `> ${raw}`);
    const trimmed = raw.trim();
    if (!trimmed) return;

    setHistory(prev => [...prev, raw]);
    setHistoryIndex(-1);

    if (trimmed === '/clear') {
      const welcome = await buildWelcomeLines(settings?.mapsFolder);
      setLines(welcome);
      sessionIdRef.current = createSessionId();
      sessionStartRef.current = new Date().toISOString();
      return;
    }
    if (trimmed === '/exit' || trimmed === '/quit') {
      addLine('stdout', '  Nothing to exit — try /clear to reset the terminal.');
      return;
    }
    if (trimmed === '/session-list') {
      await openSessionPicker();
      return;
    }

    setRunning(true);
    try {
      // Failures are already streamed as an 'error' line via 'cli-output'
      // before the invoke resolves — nothing further to render here.
      await window.electronAPI.invoke('cli-exec', { input: trimmed });
    } catch (e) {
      addLine('error', `✖ ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    // Session picker takes over ↑/↓/Enter/Esc while open.
    if (pickerSessions) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPickerIndex(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPickerIndex(i => Math.min(pickerSessions.length - 1, i + 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        openSelectedSession();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
        return;
      }
      // Any other keystroke (typing to search, etc.) closes the picker and
      // falls through to normal input handling below.
      closePicker();
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (running) return;
      const val = input;
      setInput('');
      runCommand(val);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const next = historyIndex + 1;
      if (next >= history.length) { setHistoryIndex(-1); setInput(''); }
      else { setHistoryIndex(next); setInput(history[next]); }
      return;
    }

    if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && running) {
      e.preventDefault();
      window.electronAPI.invoke('cli-abort');
      addLine('error', '^C');
      setRunning(false);
    }
  };

  return (
    <div
      className="cli-term-root"
style={{
  '--tab-color':       'var(--cliterminal-color)',
  '--tab-glow':        'var(--cliterminal-glow)',
  '--tab-glow-strong': 'var(--cliterminal-glow-strong)',
  '--tab-accent-2':    'var(--cliterminal-accent-2)',
}}
      onClick={focusInput}
    >
      <div className="cli-term-log" ref={logRef}>
        {lines.map((l, i) => (
          <span
            key={i}
            className={`cli-line ${LINE_CLS[l.type] ?? 'cli-line--stdout'}`}
            dangerouslySetInnerHTML={{
              __html: l.text === '' ? ' ' : Anser.ansiToHtml(Anser.escapeForHtml(l.text)),
            }}
          />
        ))}
      </div>

      {pickerSessions && (
        <div className="cli-term-picker">
          {pickerSessions.map((s, i) => (
            <div
              key={s.id}
              className={`cli-term-picker-row ${i === pickerIndex ? 'cli-term-picker-row--active' : ''}`}
            >
              {i === pickerIndex ? '›' : ' '} {s.preview} — {timeAgo(s.endedAt)} · {s.lineCount} lines
            </div>
          ))}
        </div>
      )}

      <div className="cli-term-footer">
        <div className="cli-term-divider" />
        <div className="cli-term-prompt-row">
          <span className="cli-term-prompt">&gt;</span>
          <input
            ref={inputRef}
            className="cli-term-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            placeholder={running ? '' : '/help'}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          {running && <span className="cli-term-busy">running… (Ctrl+C to abort)</span>}
        </div>
      </div>
    </div>
  );
};

export default CliTerminalTab;
