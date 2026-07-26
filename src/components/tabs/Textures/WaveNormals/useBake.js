/**
 * useBake — owns the bake worker and the layer results it produces.
 *
 * One worker is kept alive for the lifetime of the tab rather than spawned per
 * run: startup costs more than a small bake, and the user re-bakes constantly
 * while dialling in a sea state. A run that is superseded gets its worker
 * terminated and replaced, which is the only reliable way to cancel work inside
 * a synchronous FFT.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const PHASE_LABEL = {
  spectrum:  'building spectrum',
  transform: 'inverse transform + scatter',
};

export default function useBake() {
  const workerRef = useRef(null);
  const runIdRef  = useRef(0);

  const [layers, setLayers] = useState(null);
  const [busy, setBusy]     = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError]   = useState(null);
  const [elapsed, setElapsed] = useState(null);

  const spawn = useCallback(() => {
    const w = new Worker(new URL('./bakeWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = useCallback((payload) => {
    workerRef.current?.terminate();
    const worker = spawn();
    const runId = ++runIdRef.current;
    const t0 = performance.now();

    setBusy(true);
    setError(null);
    setProgress({ slot: 0, total: payload.only == null ? payload.slots.length : 1, phase: 'spectrum' });

    return new Promise((resolve) => {
      worker.onmessage = (e) => {
        if (runId !== runIdRef.current) return;   // a newer run took over
        const msg = e.data;

        if (msg.type === 'progress') {
          setProgress({ ...msg, label: PHASE_LABEL[msg.phase] || msg.phase });
          return;
        }
        if (msg.type === 'error') {
          setError(msg.message);
          setBusy(false);
          setProgress(null);
          resolve(null);
          return;
        }

        setLayers(prev => {
          if (payload.only == null) return msg.results;
          // Single-layer re-bake: splice the new result into the existing set.
          const next = [...(prev || [])];
          for (const r of msg.results) {
            const at = next.findIndex(l => l.index === r.index);
            if (at >= 0) next[at] = r; else next.push(r);
          }
          return next;
        });
        setElapsed(performance.now() - t0);
        setBusy(false);
        setProgress(null);
        resolve(msg.results);
      };

      worker.onerror = (ev) => {
        if (runId !== runIdRef.current) return;
        setError(ev.message || 'worker failed to start');
        setBusy(false);
        setProgress(null);
        resolve(null);
      };

      worker.postMessage(payload);
    });
  }, [spawn]);

  const cancel = useCallback(() => {
    runIdRef.current++;
    workerRef.current?.terminate();
    workerRef.current = null;
    setBusy(false);
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    setLayers(null);
    setElapsed(null);
    setError(null);
  }, []);

  return { layers, busy, progress, error, elapsed, run, cancel, reset };
}
