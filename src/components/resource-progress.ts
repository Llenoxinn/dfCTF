"use client";

import { useEffect, useState } from "react";
import { LEARNING_STORAGE_KEY, parseLearningProgress } from "@/lib/resource-learning";

export function useResourceProgress() {
  const [progress, setProgress] = useState(() => parseLearningProgress(null));
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  useEffect(() => {
    try { setProgress(parseLearningProgress(localStorage.getItem(LEARNING_STORAGE_KEY))); }
    catch { setCanSave(false); }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === LEARNING_STORAGE_KEY || event.key === null) setProgress(parseLearningProgress(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!ready || !canSave) return;
    try { localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, ...progress })); }
    catch { setCanSave(false); }
  }, [progress, ready, canSave]);
  return { progress, setProgress, ready, canSave };
}
