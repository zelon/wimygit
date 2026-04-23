export interface GitLogEntry {
  id: number;
  timestamp: Date;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

type Listener = (entries: GitLogEntry[]) => void;

let entries: GitLogEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const MAX_ENTRIES = 200;

export function pushLog(entry: Omit<GitLogEntry, "id" | "timestamp">) {
  const newEntry: GitLogEntry = { ...entry, id: nextId++, timestamp: new Date() };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), newEntry];
  listeners.forEach((l) => l(entries));
}

export function subscribeLog(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}

export function clearLog() {
  entries = [];
  listeners.forEach((l) => l(entries));
}
