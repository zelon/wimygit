import { open as shellOpen } from "@tauri-apps/plugin-shell";

// Converts a GitHub remote URL (https, ssh, or scp-like) to its web page URL.
// Returns null when the URL does not point to github.com.
export function toGitHubWebUrl(remoteUrl: string): string | null {
  const match = remoteUrl
    .trim()
    .match(/^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?github\.com(?::\d+)?[:/]+([A-Za-z0-9-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  return `https://github.com/${match[1]}/${match[2]}`;
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await shellOpen(url);
  } catch {
    window.open(url, "_blank");
  }
}
