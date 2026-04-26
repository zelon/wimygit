import { useState, useEffect, useCallback } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import {
  getPluginDir,
  loadPlugins,
  runPlugin,
  removePluginDir,
  installPlugin,
  updatePlugin,
  openInFileManager,
  type PluginInfo,
} from "../../lib";

const PLUGIN_LIST_URL = "https://raw.githubusercontent.com/zelon/wimygit-plugins/main/WimygitPlugins.xml";
const PLUGIN_MANUAL_URL = "https://github.com/zelon/wimygit/wiki/How-to-install-a-plugin";

interface PluginTabProps {
  repoPath: string;
  onRefresh: () => void;
}

const EXEC_TYPE_LABELS: Record<string, string> = {
  WithoutShellAndNoWaiting: "Fire & Forget",
  KeepShellAndNoWaiting: "Open Shell",
  WimyGitInnerShellAndRefreshRepositoryStatus: "Run & Refresh",
};

// ─── types ───────────────────────────────────────────────────────────────────

interface RemotePlugin {
  name: string;
  url: string;
}

/** Unified item shown in the left list */
interface PluginListItem {
  name: string;
  url: string;
  installed: PluginInfo | null;
}

// ─── output modal ────────────────────────────────────────────────────────────

interface OutputModalProps {
  title: string;
  output: string;
  onClose: () => void;
}

function OutputModal({ title, output, onClose }: OutputModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-sm">{title}</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-lg leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {output || "(no output)"}
          </pre>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── installed plugin detail ─────────────────────────────────────────────────

interface InstalledDetailProps {
  plugin: PluginInfo;
  repoPath: string;
  operating: string | null;
  onRefreshNeeded: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
}

function InstalledDetail({ plugin, repoPath, operating, onRefreshNeeded, onUpdate, onUninstall }: InstalledDetailProps) {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setOutput(null);
    try {
      const result = await runPlugin(
        plugin.command,
        plugin.arguments,
        plugin.execution_type,
        repoPath
      );
      if (plugin.execution_type === "WimyGitInnerShellAndRefreshRepositoryStatus") {
        setOutput(result);
        onRefreshNeeded();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const argPreview = plugin.arguments
    .map((a) =>
      a.arg_type === "repository_directory"
        ? `<repo>/${a.value}`
        : a.value || `<${a.arg_type}>`
    )
    .join(" ");

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        {plugin.title || plugin.name}
      </h2>
      {plugin.description && (
        <p className="text-sm text-gray-500 mt-0.5">{plugin.description}</p>
      )}

      {plugin.load_error ? (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          <strong>Load error:</strong> {plugin.load_error}
        </div>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2">
            <span className="text-gray-500">Command</span>
            <span className="font-mono text-gray-800 dark:text-gray-200">{plugin.command}</span>

            {argPreview && (
              <>
                <span className="text-gray-500">Arguments</span>
                <span className="font-mono text-gray-800 dark:text-gray-200 break-all">{argPreview}</span>
              </>
            )}

            <span className="text-gray-500">Execution</span>
            <span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {EXEC_TYPE_LABELS[plugin.execution_type] ?? plugin.execution_type}
              </span>
            </span>

            <span className="text-gray-500">Directory</span>
            <span className="font-mono text-xs text-gray-500 break-all">{plugin.plugin_dir}</span>
          </div>

          {plugin.execution_type === "WimyGitInnerShellAndRefreshRepositoryStatus" && (
            <p className="text-xs text-gray-400 italic">
              Output will be shown after execution. Repository status will refresh automatically.
            </p>
          )}
          {plugin.execution_type === "WithoutShellAndNoWaiting" && (
            <p className="text-xs text-gray-400 italic">
              Launches the application without waiting for it to finish.
            </p>
          )}
          {plugin.execution_type === "KeepShellAndNoWaiting" && (
            <p className="text-xs text-gray-400 italic">
              Opens a terminal window and keeps it open.
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {!plugin.load_error && (
          <button
            onClick={handleRun}
            disabled={running || !repoPath || !plugin.command}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? "Running..." : "Run"}
          </button>
        )}
        <button
          onClick={onUpdate}
          disabled={!!operating}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {operating === "update" ? "Updating..." : "Update"}
        </button>
        <button
          onClick={onUninstall}
          disabled={!!operating}
          className="px-4 py-2 text-sm text-red-600 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
        >
          {operating === "uninstall" ? "Uninstalling..." : "Uninstall"}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {output !== null && (
        <OutputModal
          title={`${plugin.title} — output`}
          output={output}
          onClose={() => setOutput(null)}
        />
      )}
    </div>
  );
}

// ─── not-installed plugin detail ─────────────────────────────────────────────

interface NotInstalledDetailProps {
  name: string;
  url: string;
  operating: string | null;
  onInstall: () => void;
}

function NotInstalledDetail({ name, url, operating, onInstall }: NotInstalledDetailProps) {
  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{name}</h2>

      <div className="mt-4 space-y-2 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2">
          <span className="text-gray-500">URL</span>
          <span className="font-mono text-gray-800 dark:text-gray-200 break-all">{url}</span>

          <span className="text-gray-500">Status</span>
          <span className="text-gray-500">Not installed</span>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={onInstall}
          disabled={!!operating}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {operating === "install" ? "Installing..." : "Install"}
        </button>
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function PluginTab({ repoPath, onRefresh }: PluginTabProps) {
  const [pluginsDir, setPluginsDir] = useState<string>("");
  const [installedPlugins, setInstalledPlugins] = useState<PluginInfo[]>([]);
  const [remotePlugins, setRemotePlugins] = useState<RemotePlugin[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operating, setOperating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);

  // Fetch installed plugins from local directory
  const fetchInstalled = useCallback(async () => {
    try {
      const dir = await getPluginDir();
      setPluginsDir(dir);
      const list = await loadPlugins(dir);
      setInstalledPlugins(list);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // Fetch remote plugin list from XML
  const fetchRemote = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const response = await fetch(PLUGIN_LIST_URL, { method: "GET" });
      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      const nodes = doc.querySelectorAll("wimygit-plugins > plugin");
      const list: RemotePlugin[] = [];
      nodes.forEach((node) => {
        const name = node.querySelector("name")?.textContent?.trim();
        const pluginUrl = node.querySelector("url")?.textContent?.trim();
        if (name && pluginUrl) {
          list.push({ name, url: pluginUrl });
        }
      });
      setRemotePlugins(list);
    } catch {
      // remote list unavailable — show only installed plugins
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchInstalled(), fetchRemote()]);
      setLoading(false);
    })();
  }, [fetchInstalled, fetchRemote]);

  // Build unified list: remote plugins + any installed plugins not in the remote list
  // Match by git clone folder name: last segment of URL vs last segment of plugin_dir
  const dirName = (s: string) => s.replace(/\/+$/, "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const pluginList: PluginListItem[] = (() => {
    const items: PluginListItem[] = remotePlugins.map((rp) => {
      const rpDir = dirName(rp.url);
      const installed = installedPlugins.find(
        (ip) => dirName(ip.plugin_dir) === rpDir
      ) ?? null;
      return { name: rp.name, url: rp.url, installed };
    });
    // Add locally installed plugins that aren't in the remote list
    for (const ip of installedPlugins) {
      const ipDir = dirName(ip.plugin_dir);
      if (!items.find((item) => dirName(item.url) === ipDir)) {
        items.push({ name: ip.name, url: "", installed: ip });
      }
    }
    return items;
  })();

  const selectedItem = pluginList.find((p) => p.name === selectedName) ?? null;

  const handleInstall = async (item: PluginListItem) => {
    if (!item.url || !pluginsDir) return;
    setOperating("install");
    setError(null);
    try {
      await installPlugin(pluginsDir, item.url);
      setSuccessMsg(`"${item.name}" installed`);
      await fetchInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleUpdate = async (plugin: PluginInfo) => {
    setOperating("update");
    setError(null);
    try {
      const result = await updatePlugin(plugin.plugin_dir);
      setSuccessMsg(result || `"${plugin.title}" updated`);
      await fetchInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleUninstall = async (plugin: PluginInfo) => {
    if (!confirm(`Uninstall "${plugin.title}"?\nDirectory: ${plugin.plugin_dir}`)) return;
    setOperating("uninstall");
    setError(null);
    try {
      await removePluginDir(plugin.plugin_dir);
      setSuccessMsg(`"${plugin.title}" uninstalled`);
      await fetchInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleManualInstall = async () => {
    if (!manualUrl.trim() || !pluginsDir) return;
    setManualBusy(true);
    setError(null);
    try {
      await installPlugin(pluginsDir, manualUrl.trim());
      setSuccessMsg("Plugin installed successfully.");
      setManualUrl("");
      setManualOpen(false);
      await fetchInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setManualBusy(false);
    }
  };

  const openManualLink = async () => {
    try {
      await shellOpen(PLUGIN_MANUAL_URL);
    } catch {
      window.open(PLUGIN_MANUAL_URL, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading plugins...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top: action buttons ── */}
      <div className="flex gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
        <button
          onClick={openManualLink}
          className="flex-1 py-2 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
        >
          How to install a plugin manually (Link)
        </button>
        <button
          onClick={() => pluginsDir && openInFileManager(pluginsDir)}
          className="flex-1 py-2 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
        >
          Open Plugin Folder in Explorer
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: plugin list ── */}
        <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Error / success */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
              {error}
              <button onClick={() => setError(null)} className="ml-1 underline">×</button>
            </div>
          )}
          {successMsg && (
            <div className="px-3 py-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
              {successMsg}
              <button onClick={() => setSuccessMsg(null)} className="ml-1 underline">×</button>
            </div>
          )}

          {/* Plugin list */}
          <div className="flex-1 overflow-y-auto">
            {loadingRemote && pluginList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
                Loading plugin list...
              </div>
            ) : pluginList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-xs">
                No plugins available.
              </div>
            ) : (
              pluginList.map((item) => {
                const isSelected = selectedName === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedName(item.name)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-800 ${
                      isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                      {item.installed?.title || item.name}
                    </span>
                    {item.installed && (
                      <span className="text-[10px] text-green-600 dark:text-green-400">installed</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: plugin detail ── */}
        <div className="flex-1 overflow-auto">
          {selectedItem ? (
            selectedItem.installed ? (
              <InstalledDetail
                plugin={selectedItem.installed}
                repoPath={repoPath}
                operating={operating}
                onRefreshNeeded={onRefresh}
                onUpdate={() => handleUpdate(selectedItem.installed!)}
                onUninstall={() => handleUninstall(selectedItem.installed!)}
              />
            ) : (
              <NotInstalledDetail
                name={selectedItem.name}
                url={selectedItem.url}
                operating={operating}
                onInstall={() => handleInstall(selectedItem)}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a plugin to view details.
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: manual install ── */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {manualOpen ? (
          <div className="flex items-center gap-2 p-2">
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleManualInstall()}
            />
            <button
              onClick={handleManualInstall}
              disabled={!manualUrl.trim() || manualBusy}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {manualBusy ? "Installing..." : "Install"}
            </button>
            <button
              onClick={() => { setManualOpen(false); setManualUrl(""); }}
              className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="p-2">
            <button
              onClick={() => setManualOpen(true)}
              className="w-full py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              Manual Install (Git URL)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
