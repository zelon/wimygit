import { useState, useEffect, useRef } from "react";

export interface AutoFetchSettings {
  enabled: boolean;
  intervalMinutes: number;
}

export const AUTO_FETCH_STORAGE_KEY = "wimygit_auto_fetch";
export const AUTO_FETCH_INTERVALS = [1, 2, 5, 10, 15, 30] as const;

export function loadAutoFetchSettings(): AutoFetchSettings {
  try {
    const raw = localStorage.getItem(AUTO_FETCH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        intervalMinutes: (AUTO_FETCH_INTERVALS as readonly number[]).includes(parsed.intervalMinutes)
          ? parsed.intervalMinutes
          : 5,
      };
    }
  } catch {
    // ignore
  }
  return { enabled: false, intervalMinutes: 5 };
}

export function saveAutoFetchSettings(settings: AutoFetchSettings): void {
  localStorage.setItem(AUTO_FETCH_STORAGE_KEY, JSON.stringify(settings));
}

interface UseAutoFetchOptions {
  settings: AutoFetchSettings;
  repoPath: string | null;
  isBusy: boolean;
  onFetch: () => Promise<void>;
}

export interface UseAutoFetchResult {
  lastFetchedAt: Date | null;
  nextFetchIn: number;
  isFetching: boolean;
}

export function useAutoFetch({
  settings,
  repoPath,
  isBusy,
  onFetch,
}: UseAutoFetchOptions): UseAutoFetchResult {
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [nextFetchIn, setNextFetchIn] = useState(settings.intervalMinutes * 60);
  const [isFetching, setIsFetching] = useState(false);

  const nextFetchInRef = useRef(settings.intervalMinutes * 60);
  const isBusyRef = useRef(isBusy);
  const isFetchingRef = useRef(false);
  const onFetchRef = useRef(onFetch);
  const settingsRef = useRef(settings);

  useEffect(() => { isBusyRef.current = isBusy; }, [isBusy]);
  useEffect(() => { onFetchRef.current = onFetch; }, [onFetch]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Reset countdown when interval, enabled state, or repo changes
  useEffect(() => {
    const secs = settings.intervalMinutes * 60;
    nextFetchInRef.current = secs;
    setNextFetchIn(secs);
  }, [settings.intervalMinutes, settings.enabled, repoPath]);

  useEffect(() => {
    if (!settings.enabled || !repoPath) return;

    const tick = setInterval(async () => {
      nextFetchInRef.current -= 1;
      setNextFetchIn(nextFetchInRef.current);

      if (nextFetchInRef.current > 0) return;

      // Reset timer immediately before fetching
      const secs = settingsRef.current.intervalMinutes * 60;
      nextFetchInRef.current = secs;
      setNextFetchIn(secs);

      // Skip if a manual operation or previous auto-fetch is in progress
      if (isBusyRef.current || isFetchingRef.current) return;

      isFetchingRef.current = true;
      setIsFetching(true);
      try {
        await onFetchRef.current();
        setLastFetchedAt(new Date());
      } catch {
        // Errors are logged via the git-log event system
      } finally {
        isFetchingRef.current = false;
        setIsFetching(false);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [settings.enabled, repoPath]);

  return { lastFetchedAt, nextFetchIn, isFetching };
}
