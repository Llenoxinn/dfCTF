"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { LEARNING_STORAGE_KEY, parseLearningProgress, type LearningProgress } from "@/lib/resource-learning";
import { applyLearningPatch, diffLearningProgress, learningPatchSchema, mergeLearningPatches, type LearningPatch } from "@/lib/learning-progress";

type SyncState = "local" | "loading" | "saving" | "synced" | "error";
type ProgressContext = {
  progress: LearningProgress; setProgress: (update: SetStateAction<LearningProgress>) => void;
  ready: boolean; canSave: boolean; userId: string | null; syncState: SyncState;
  error: string; retry: () => void; canImport: boolean; importBrowser: () => void;
};
const Context = createContext<ProgressContext | null>(null);

export function LearningProgressProvider({ userId = null, children }: { userId?: string | null; children: ReactNode }) {
  const [progress, setState] = useState(() => parseLearningProgress(null));
  const [ready, setReady] = useState(false), [canSave, setCanSave] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>(userId ? "loading" : "local");
  const [error, setError] = useState(""), [canImport, setCanImport] = useState(false);
  const state = useRef(progress), pending = useRef<LearningPatch>({}), sending = useRef<LearningPatch | null>(null);
  const mounted = useRef(false), busy = useRef(false), connected = useRef(false), loaded = useRef(false), imported = useRef(false);
  const identityBlocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => void>(() => {}), loadRef = useRef<() => void>(() => {});
  const key = userId ? `${LEARNING_STORAGE_KEY}:${encodeURIComponent(userId)}` : LEARNING_STORAGE_KEY;
  const headers = { "Content-Type": "application/json", "X-dfCTF-Request": "1", "X-dfCTF-Account": userId ?? "" };

  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, ...state.current, ...(userId ? { pending: mergeLearningPatches(sending.current ?? {}, pending.current), importedGuest: imported.current } : {}) }));
    } catch { if (mounted.current) setCanSave(false); }
  }
  function publish(next: LearningProgress) {
    state.current = next;
    if (mounted.current) { setState(next); persist(); }
  }
  function schedule() {
    clearTimeout(timer.current);
    if (userId && loaded.current) timer.current = setTimeout(() => flushRef.current(), 400);
  }
  function setProgress(update: SetStateAction<LearningProgress>) {
    if (identityBlocked.current) return;
    const next = typeof update === "function" ? update(state.current) : update;
    if (next === state.current) return;
    if (userId) pending.current = mergeLearningPatches(pending.current, diffLearningProgress(state.current, next));
    publish(next);
    if (userId && connected.current) setSyncState("saving");
    schedule();
  }
  async function response(response: Response) {
    const blockIdentity = () => {
      identityBlocked.current = true;
      if (mounted.current) { setState(parseLearningProgress(null)); setReady(false); setCanImport(false); }
    };
    if ([401, 403, 409].includes(response.status)) blockIdentity();
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Account sync is unavailable. Try again.");
    if (body.userId !== userId) { blockIdentity(); throw new Error("Your signed-in account changed. Refresh this page before syncing."); }
    identityBlocked.current = false;
    return parseLearningProgress(JSON.stringify({ version: 1, ...body.progress }));
  }
  flushRef.current = async () => {
    if (!userId || identityBlocked.current || !connected.current || busy.current || !Object.keys(pending.current).length) return;
    busy.current = true; sending.current = pending.current; pending.current = {}; persist();
    const patch = sending.current;
    let success = false;
    try {
      const remote = await response(await fetch("/api/v1/learning/progress", { method: "PATCH", headers, body: JSON.stringify(patch), keepalive: true }));
      sending.current = null; success = true;
      if (mounted.current) { publish(applyLearningPatch(remote, pending.current)); setSyncState(Object.keys(pending.current).length ? "saving" : "synced"); setError(""); }
    } catch (failure) {
      pending.current = mergeLearningPatches(patch, pending.current); sending.current = null;
      if (mounted.current) { persist(); setSyncState("error"); setError(failure instanceof Error ? failure.message : "Account sync is unavailable."); }
    } finally { busy.current = false; if (success && mounted.current) schedule(); }
  };
  loadRef.current = async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    if (mounted.current) setSyncState("loading");
    try {
      const remote = await response(await fetch("/api/v1/learning/progress", { headers, cache: "no-store" }));
      connected.current = true;
      if (mounted.current) { publish(applyLearningPatch(remote, pending.current)); setSyncState(Object.keys(pending.current).length ? "saving" : "synced"); setError(""); }
    } catch (failure) {
      connected.current = false;
      if (mounted.current) { setSyncState("error"); setError(failure instanceof Error ? failure.message : "Account sync is unavailable."); }
    } finally {
      busy.current = false; loaded.current = true;
      if (mounted.current) { setReady(!identityBlocked.current); schedule(); }
    }
  };

  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(key);
      state.current = parseLearningProgress(raw); setState(state.current);
      if (userId && raw) {
        try {
          const cache = JSON.parse(raw);
          pending.current = learningPatchSchema.safeParse(cache?.pending).data ?? {};
          imported.current = cache?.importedGuest === true;
        } catch { /* Ignore a corrupt account cache; reload the server copy. */ }
      }
      const guest = parseLearningProgress(localStorage.getItem(LEARNING_STORAGE_KEY));
      setCanImport(Boolean(userId && !imported.current && (guest.bookmarks.length || guest.completed.length || guest.last)));
    } catch { setCanSave(false); }
    if (userId) void loadRef.current(); else { loaded.current = true; setReady(true); }
    const online = () => loadRef.current();
    const focus = () => { if (document.visibilityState === "visible") loadRef.current(); };
    const sync = (event: StorageEvent) => {
      if ((event.key !== key && event.key !== null) || busy.current || identityBlocked.current) return;
      const next = parseLearningProgress(event.newValue);
      if (userId && event.newValue) {
        try { pending.current = mergeLearningPatches(pending.current, learningPatchSchema.safeParse(JSON.parse(event.newValue).pending).data ?? {}); }
        catch { return; }
      }
      state.current = next; setState(next); schedule();
    };
    window.addEventListener("storage", sync); window.addEventListener("online", online); window.addEventListener("focus", focus);
    return () => {
      clearTimeout(timer.current);
      if (userId && !identityBlocked.current && connected.current && !busy.current && Object.keys(pending.current).length) {
        void fetch("/api/v1/learning/progress", { method: "PATCH", headers, body: JSON.stringify(pending.current), keepalive: true }).catch(() => {});
      }
      mounted.current = false;
      window.removeEventListener("storage", sync); window.removeEventListener("online", online); window.removeEventListener("focus", focus);
    };
  }, [key]);

  function importBrowser() {
    try {
      const guest = parseLearningProgress(localStorage.getItem(LEARNING_STORAGE_KEY));
      imported.current = true; setCanImport(false);
      setProgress({ bookmarks: [...new Set([...state.current.bookmarks, ...guest.bookmarks])], completed: [...new Set([...state.current.completed, ...guest.completed])], open: { ...guest.open, ...state.current.open }, last: state.current.last ?? guest.last });
    } catch { setCanSave(false); }
  }
  return <Context.Provider value={{ progress, setProgress, ready, canSave, userId, syncState, error, retry: () => loadRef.current(), canImport, importBrowser }}>{children}</Context.Provider>;
}

export function useResourceProgress() {
  const context = useContext(Context);
  if (!context) throw new Error("Learning progress requires its provider.");
  return context;
}

export function LearningProgressNotice() {
  const { userId, syncState, canSave, error, retry, canImport, importBrowser } = useResourceProgress();
  let message = canSave ? "Your reading place, bookmarks, and topics marked read are saved in this browser. Sign in to sync them between devices." : "Browser storage is unavailable; changes will not survive a reload.";
  if (userId) message = syncState === "synced" ? "Saved to your account. Your learning progress is available on your other devices." : syncState === "loading" ? "Loading your account progress…" : syncState === "saving" ? "Saving your learning progress…" : `${error} ${canSave ? "Your changes are saved on this device until sync resumes." : "Keep this tab open and retry syncing."}`;
  return <div className="resource-save-note"><p role="status">{message}</p>{userId && syncState === "error" ? <button className="text-button" type="button" onClick={retry}>Retry account sync</button> : null}{canImport ? <button type="button" className="text-button" onClick={importBrowser}>Add this browser’s progress to my account</button> : null}</div>;
}
