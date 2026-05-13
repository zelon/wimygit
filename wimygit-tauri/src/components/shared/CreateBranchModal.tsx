import { useState, useRef, useEffect } from "react";

interface CreateBranchModalProps {
  commitHash: string;
  hasRemotes: boolean;
  onConfirm: (branchName: string, checkout: boolean, pushToRemote: boolean) => void;
  onCancel: () => void;
}

export function CreateBranchModal({ commitHash, hasRemotes, onConfirm, onCancel }: CreateBranchModalProps) {
  const [branchName, setBranchName] = useState("");
  const [checkout, setCheckout] = useState(true);
  const [pushToRemote, setPushToRemote] = useState(hasRemotes);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && branchName.trim()) {
      onConfirm(branchName.trim(), checkout, hasRemotes ? pushToRemote : false);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Create Branch</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          at commit <span className="font-mono">{commitHash.slice(0, 7)}</span>
        </p>

        <input
          ref={inputRef}
          type="text"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New branch name"
          className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checkout}
            onChange={(e) => setCheckout(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300">Checkout after creation</span>
        </label>

        {hasRemotes && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pushToRemote}
              onChange={(e) => setPushToRemote(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">Push to remote</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(branchName.trim(), checkout, hasRemotes ? pushToRemote : false)}
            disabled={!branchName.trim()}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Branch
          </button>
        </div>
      </div>
    </div>
  );
}
