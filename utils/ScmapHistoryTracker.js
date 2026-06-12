/**
 * ScmapHistoryTracker.js
 *
 * Snapshots the unpacked scmap folder state (before + after generate).
 * Stores diffs in-memory (per-tab Map) + persists to disk via IPC.
 * Max MAX_ENTRIES per tab.
 *
 * Persistence: ipcRenderer.invoke('history-load') / ('history-save', data)
 * The main process writes/reads a JSON file in the userData folder.
 * No localStorage / sessionStorage used — avoids QuotaExceededError.
 */

const MAX_ENTRIES = 10;

const ALL_TABS = [
  'wreckages','props','emitter','customprops','treemap',
  'rockerosion','stars','skybox-generator','scmaptool','previewimage',
  'history-editor',
];

// ─── In-memory store ──────────────────────────────────────────────────────────

// Map<tabId, Entry[]>
const _store = new Map();

// Pending "before" snapshots for in-progress generate runs
// Map<tabId, snapshot>
const _pendingBefore = new Map();

// ─── IPC helper ───────────────────────────────────────────────────────────────

function getIpc() {
  try {
    return window?.require?.('electron')?.ipcRenderer ?? null;
  } catch {
    return null;
  }
}

// ─── Disk persistence ─────────────────────────────────────────────────────────

// Cache the in-flight Promise so concurrent callers all await the same load.
// A boolean flag would be set to true before the await resolves, causing
// subsequent callers to skip loading and later overwrite disk with an empty store.
let _loadPromise = null;

function loadFromDisk() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const ipc = getIpc();
      if (!ipc) return;
      const result = await ipc.invoke('history-load');
      if (result?.data && typeof result.data === 'object') {
        for (const [tabId, entries] of Object.entries(result.data)) {
          if (Array.isArray(entries)) {
            _store.set(tabId, entries.slice(-MAX_ENTRIES));
          }
        }
      }
    } catch (e) {
      console.warn('[ScmapHistory] Failed to load from disk:', e);
      _loadPromise = null; // allow retry on next call
    }
  })();
  return _loadPromise;
}

async function saveToDisk() {
  try {
    const ipc = getIpc();
    if (!ipc) return;
    const data = {};
    for (const [tabId, entries] of _store.entries()) {
      data[tabId] = entries;
    }
    const result = await ipc.invoke('history-save', { data });
    if (!result?.success) {
      console.warn('[ScmapHistory] history-save returned failure:', result);
    }
  } catch (e) {
    console.warn('[ScmapHistory] Failed to save to disk:', e);
  }
}

// ─── Internal store helpers ───────────────────────────────────────────────────

function _getEntries(tabId) {
  return _store.get(tabId) ?? [];
}

function _setEntries(tabId, entries) {
  _store.set(tabId, entries.slice(-MAX_ENTRIES));
}

// ─── File type helpers ────────────────────────────────────────────────────────

export function isBinary(filename) {
  return /\.(dds|raw|png|jpg|jpeg|bmp|tga)$/i.test(filename);
}

export function isLua(filename) {
  return /\.lua$/i.test(filename);
}

export function fileCategory(filename) {
  if (/^props\d*\.lua$/i.test(filename))   return 'props';
  if (/^data\.lua$/i.test(filename))        return 'data';
  if (/\.lua$/i.test(filename))             return 'lua';
  if (/previewimage/i.test(filename))       return 'previewImage';
  if (/normalmap/i.test(filename))          return 'normalMap';
  if (/heightmap/i.test(filename))          return 'heightmap';
  if (/texturemask/i.test(filename))        return 'textureMask';
  if (/watermap/i.test(filename))           return 'waterMap';
  if (/\.dds$/i.test(filename))             return 'dds';
  if (/\.raw$/i.test(filename))             return 'raw';
  return 'other';
}

// ─── Diff computation ─────────────────────────────────────────────────────────

export function diffScmapSnapshots(before, after) {
  const beforeFiles = before?.files ?? {};
  const afterFiles  = after?.files  ?? {};

  const allNames = new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)]);

  const added     = [];
  const removed   = [];
  const modified  = [];
  const unchanged = [];

  for (const name of [...allNames].sort()) {
    const b = beforeFiles[name];
    const a = afterFiles[name];

    if (!b && a) {
      added.push({ name, file: a, category: fileCategory(name) });
      continue;
    }
    if (b && !a) {
      removed.push({ name, file: b, category: fileCategory(name) });
      continue;
    }

    const binary = isBinary(name);
    if (binary) {
      if (b.size !== a.size) {
        modified.push({
          name, category: fileCategory(name),
          before: b, after: a,
          sizeDelta: a.size - b.size,
          contentDiff: null,
        });
      } else {
        unchanged.push({ name });
      }
    } else {
      if (b.content !== a.content) {
        modified.push({
          name, category: fileCategory(name),
          before: b, after: a,
          sizeDelta: (a.size ?? 0) - (b.size ?? 0),
          contentDiff: computeLineDiff(b.content ?? '', a.content ?? ''),
        });
      } else {
        unchanged.push({ name });
      }
    }
  }

  return { added, removed, modified, unchanged };
}

export function computeLineDiff(before, after) {
  const bLines = before.split('\n');
  const aLines = after.split('\n');
  const m = bLines.length;
  const n = aLines.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (bLines[i - 1] === aLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && bLines[i - 1] === aLines[j - 1]) {
      result.unshift({ type: 'equal', line: bLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', line: aLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', line: bLines[i - 1] });
      i--;
    }
  }

  return result;
}

// ─── Patch application ────────────────────────────────────────────────────────

/**
 * Applies the inverse of a stored before→after diff onto `currentContent`.
 *
 * The diff is a sequence of { type: 'equal'|'added'|'removed', line } entries
 * produced by computeLineDiff(before, after).
 *
 * Inverse means:
 *   - 'added'   lines (were inserted in the recorded change) → remove them
 *   - 'removed' lines (were deleted in the recorded change)  → restore them
 *   - 'equal'   lines                                        → keep as anchor
 *
 * The patch walks the current file line-by-line matching 'equal' anchors.
 * If an anchor line cannot be found in the expected position the patch is
 * aborted and an error is thrown so the caller can surface a clear message.
 *
 * Returns the patched content string.
 */
export function applyInvertedDiff(currentContent, contentDiff) {
  if (!contentDiff || contentDiff.length === 0) return currentContent;

  const current = currentContent.split('\n');
  const result  = [];
  let ci = 0; // cursor into current[]

  for (let di = 0; di < contentDiff.length; di++) {
    const { type, line } = contentDiff[di];

    if (type === 'equal') {
      // Anchor: current file must have this line here
      if (ci >= current.length || current[ci] !== line) {
        throw new Error(
          `Patch conflict at line ${ci + 1}: expected "${line}" but found "${current[ci] ?? '<end of file>'}". ` +
          `The file has been changed since this snapshot was recorded.`
        );
      }
      result.push(line);
      ci++;

    } else if (type === 'added') {
      // This line was added by the recorded change → skip it in current
      // (it should be present in current; if not, someone already removed it)
      if (ci < current.length && current[ci] === line) {
        ci++; // consume without emitting = delete it
      }
      // If it's already gone, silently skip — idempotent

    } else if (type === 'removed') {
      // This line was removed by the recorded change → restore it
      // Do NOT advance ci — we insert before the current position
      result.push(line);
    }
  }

  // Append any trailing lines that come after the last diff entry
  while (ci < current.length) {
    result.push(current[ci++]);
  }

  return result.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function storePendingBefore(tabId, snapshot) {
  _pendingBefore.set(tabId, snapshot);
}

export function loadPendingBefore(tabId) {
  return _pendingBefore.get(tabId) ?? null;
}

export function clearPendingBefore(tabId) {
  _pendingBefore.delete(tabId);
}

// ─── Lightweight summary for tabs that skip full LCS diff ────────────────────
// Only compares file names + sizes — O(n), safe for large props files.
function _cheapSummary(before, after) {
  const bf = before?.files ?? {};
  const af = after?.files  ?? {};
  const allNames = new Set([...Object.keys(bf), ...Object.keys(af)]);
  let added = 0, removed = 0, modified = 0;
  const addedNames = [], removedNames = [], modifiedNames = [];
  for (const name of allNames) {
    const b = bf[name], a = af[name];
    if (!b && a)  { added++;    addedNames.push(name);    }
    else if (b && !a) { removed++; removedNames.push(name); }
    else if (b.size !== a.size) { modified++; modifiedNames.push(name); }
  }
  return { added, removed, modified, addedNames, removedNames, modifiedNames };
}

// Tabs that store full before/after snapshots for whole-snapshot restore
// but skip the expensive LCS line-diff (which can OOM on large props files).
const SNAPSHOT_RESTORE_TABS = new Set(['treemap']);

export async function commitHistoryEntry(tabId, mapName, before, after) {
  await loadFromDisk();

  let diff, summary;

  if (SNAPSHOT_RESTORE_TABS.has(tabId)) {
    // Cheap path: no LCS, no contentDiff — just name/size comparison.
    // The full before/after snapshots are kept so the UI can restore them wholesale.
    const cheap = _cheapSummary(before, after);
    diff = null; // signals "snapshot-restore mode" to History.jsx
    summary = {
      added:    cheap.added,
      removed:  cheap.removed,
      modified: cheap.modified,
      addedNames:    cheap.addedNames,
      removedNames:  cheap.removedNames,
      modifiedNames: cheap.modifiedNames,
    };
  } else {
    diff = diffScmapSnapshots(before, after);
    summary = {
      added:    diff.added.length,
      removed:  diff.removed.length,
      modified: diff.modified.length,
    };
  }

  const entry = {
    id:        Date.now(),
    timestamp: new Date().toISOString(),
    tabId,
    mapName,
    before,
    after,
    diff,
    summary,
  };

  const history = _getEntries(tabId);
  history.push(entry);
  _setEntries(tabId, history);

  saveToDisk().catch(e => console.warn('[ScmapHistory] Background save failed:', e));

  return entry;
}

export async function getHistory(tabId) {
  await loadFromDisk();
  return _getEntries(tabId);
}

export async function getAllHistory() {
  await loadFromDisk();
  const entries = [];
  for (const tabId of ALL_TABS) {
    for (const e of _getEntries(tabId)) {
      entries.push(e);
    }
  }
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function clearTabHistory(tabId) {
  await loadFromDisk();
  _store.delete(tabId);
  await saveToDisk();
}

export async function getTabsWithHistory() {
  await loadFromDisk();
  return ALL_TABS
    .map(tabId => ({ tabId, count: _getEntries(tabId).length }))
    .filter(t => t.count > 0);
}

export function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return '?';
  if (Math.abs(bytes) < 1024) return `${bytes} B`;
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}