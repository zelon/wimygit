import { useState, useEffect, useCallback } from "react";
import { fetch } from "@tauri-apps/plugin-http";
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

interface PluginTabProps {
  repoPath: string;
  onRefresh: () => void;
}

const EXEC_TYPE_LABELS: Record<string, string> = {
  WithoutShellAndNoWaiting: "Fire & Forget",
  KeepShellAndNoWaiting: "Open Shell",
  WimyGitInnerShellAndRefreshRepositoryStatus: "Run & Refresh",
};

// ─── output modal ─────────────────────────────────────────────────────────────

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

// ─── install modal ────────────────────────────────────────────────────────────

interface InstallModalProps {
  pluginsDir: string;
  onClose: () => void;
  onInstalled: () => void;
}

interface RemotePlugin {
  name: string;
  url: string;
}

function InstallModal({ pluginsDir, onClose, onInstalled }: InstallModalProps) {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [remotePlugins, setRemotePlugins] = useState<RemotePlugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(true);

  useEffect(() => {
    (async () => {
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
        // silently ignore — user can still paste a URL manually
      } finally {
        setLoadingPlugins(false);
      }
    })();
  }, []);

  const handleInstall = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setOutput("");
    setError("");
    try {
      const result = await installPlugin(pluginsDir, url.trim());
      setOutput(result || "Plugin installed successfully.");
      onInstalled();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[560px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-sm">Install Plugin</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-lg">
            &times;
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste a Git repository URL. The plugin will be cloned into:<br />
            <span className="font-mono text-gray-700 dark:text-gray-300 break-all">{pluginsDir}</span>
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Git URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleInstall()}
            />
          </div>

          {loadingPlugins ? (
            <p className="text-xs text-gray-400">Loading plugin list...</p>
          ) : remotePlugins.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Available plugins:</p>
              <div className="space-y-1">
                {remotePlugins.map((p) => (
                  <button
                    key={p.url}
                    onClick={() => setUrl(p.url)}
                    className="block text-xs text-blue-600 dark:text-blue-400 hover:underline text-left"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs">
              {error}
            </div>
          )}
          {output && (
            <pre className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono max-h-32 overflow-auto">
              {output}
            </pre>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
          <button
            onClick={handleInstall}
            disabled={!url.trim() || running}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? "Installing..." : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── plugin detail ────────────────────────────────────────────────────────────

interface PluginDetailProps {
  plugin: PluginInfo;
  repoPath: string;
  onRunComplete: () => void;
}

function PluginDetail({ plugin, repoPath, onRefreshNeeded, onRunComplete }: PluginDetailProps & { onRefreshNeeded: () => void }) {
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
      onRunComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  // Build argument preview
  const argPreview = plugin.arguments
    .map((a) =>
      a.arg_type === "repository_directory"
        ? `<repo>/${a.value}`
        : a.value || `<${a.arg_type}>`
    )
    .join(" ");

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {plugin.title || plugin.name}
          </h2>
          {plugin.description && (
            <p className="text-sm text-gray-500 mt-0.5">{plugin.description}</p>
          )}
        </div>
        {!plugin.load_error && (
          <button
            onClick={handleRun}
            disabled={running || !repoPath || !plugin.command}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0 ml-4"
          >
            {running ? "Running..." : "Run"}
          </button>
        )}
      </div>

      {plugin.load_error ? (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
          <strong>Load error:</strong> {plugin.load_error}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
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

// ─── main component ───────────────────────────────────────────────────────────

export function PluginTab({ repoPath, onRefresh }: PluginTabProps) {
  const [pluginsDir, setPluginsDir] = useState<string>("");
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [selected, setSelected] = useState<PluginInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operating, setOperating] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dir = await getPluginDir();
      setPluginsDir(dir);
      const list = await loadPlugins(dir);
      setPlugins(list);
      // Keep selection valid
      if (selected && !list.find((p) => p.plugin_dir === selected.plugin_dir)) {
        setSelected(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleUpdate = async (plugin: PluginInfo) => {
    setOperating(`update-${plugin.name}`);
    setError(null);
    try {
      const result = await updatePlugin(plugin.plugin_dir);
      setSuccessMsg(result || `"${plugin.title}" updated`);
      await fetchPlugins();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
    }
  };

  const handleUninstall = async (plugin: PluginInfo) => {
    if (!confirm(`Uninstall "${plugin.title}"?\nDirectory: ${plugin.plugin_dir}`)) return;
    setOperating(`uninstall-${plugin.name}`);
    setError(null);
    try {
      await removePluginDir(plugin.plugin_dir);
      setSuccessMsg(`"${plugin.title}" uninstalled`);
      if (selected?.plugin_dir === plugin.plugin_dir) setSelected(null);
      await fetchPlugins();
    } catch (e) {
      setError(String(e));
    } finally {
      setOperating(null);
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
    <div className="flex h-full overflow-hidden">
      {/* ── Left: plugin list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-1">
          <button
            onClick={() => setShowInstall(true)}
            className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Install
          </button>
          <button
            onClick={() => pluginsDir && openInFileManager(pluginsDir)}
            className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            title="Open plugins folder"
          >
            Folder
          </button>
          <button
            onClick={fetchPlugins}
            className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            title="Reload plugins"
          >
            ↻
          </button>
        </div>

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
          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4 text-gray-400 text-xs">
              <p>No plugins installed.</p>
              <button
                onClick={() => setShowInstall(true)}
                className="mt-2 text-blue-500 hover:underline"
              >
                Install a plugin
              </button>
            </div>
          ) : (
            plugins.map((p) => {
              const isSelected = selected?.plugin_dir === p.plugin_dir;
              return (
                <div
                  key={p.plugin_dir}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    isSelected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <button
                    onClick={() => setSelected(p)}
                    className="w-full text-left px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {p.load_error && (
                        <span className="text-red-500 text-xs" title={p.load_error}>!</span>
                      )}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {p.title || p.name}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{p.description}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {EXEC_TYPE_LABELS[p.execution_type] ?? p.execution_type}
                    </p>
                  </button>

                  {/* Per-plugin actions (shown when selected) */}
                  {isSelected && (
                    <div className="flex gap-1 px-3 pb-2">
                      <button
                        onClick={() => handleUpdate(p)}
                        disabled={!!operating}
                        className="px-2 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                      >
                        {operating === `update-${p.name}` ? "Updating..." : "Update"}
                      </button>
                      <button
                        onClick={() => handleUninstall(p)}
                        disabled={!!operating}
                        className="px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                      >
                        Uninstall
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Plugins dir path */}
        <div className="px-3 py-2 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800 truncate" title={pluginsDir}>
          {pluginsDir}
        </div>
      </div>

      {/* ── Right: plugin detail ── */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <PluginDetail
            plugin={selected}
            repoPath={repoPath}
            onRunComplete={() => {}}
            onRefreshNeeded={onRefresh}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
            <p>Select a plugin to view details and run it.</p>
            <p className="text-xs">
              Plugins are loaded from <span className="font-mono">{pluginsDir}</span>
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showInstall && (
        <InstallModal
          pluginsDir={pluginsDir}
          onClose={() => setShowInstall(false)}
          onInstalled={async () => {
            setShowInstall(false);
            await fetchPlugins();
          }}
        />
      )}
    </div>
  );
}

