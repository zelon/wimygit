import { listen } from "@tauri-apps/api/event";

export interface GitLogEntry {
  id: number;
  timestamp: Date;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

type Listener = (entries: GitLogEntry[]) => void;

let entries: GitLogEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const MAX_ENTRIES = 200;

function pushLog(entry: Omit<GitLogEntry, "id" | "timestamp">) {
  const newEntry: GitLogEntry = { ...entry, id: nextId++, timestamp: new Date() };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), newEntry];
  listeners.forEach((l) => l(entries));
}

// Listen for git-log events emitted by the Rust backend
listen<{ command: string; stdout: string; stderr: string; exit_code: number; duration_ms: number }>(
  "git-log",
  (event) => {
    pushLog({
      command: event.payload.command,
      stdout: event.payload.stdout,
      stderr: event.payload.stderr,
      exitCode: event.payload.exit_code,
      durationMs: event.payload.duration_ms,
    });
  },
);

export function subscribeLog(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}

export function clearLog() {
  entries = [];
  listeners.forEach((l) => l(entries));
}
