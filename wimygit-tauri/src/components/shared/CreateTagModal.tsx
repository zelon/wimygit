import { useState, useRef, useEffect } from "react";

interface CreateTagModalProps {
  commitHash: string;
  onConfirm: (tagName: string) => void;
  onCancel: () => void;
}

export function CreateTagModal({ commitHash, onConfirm, onCancel }: CreateTagModalProps) {
  const [tagName, setTagName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagName.trim()) {
      onConfirm(tagName.trim());
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Create Tag</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          at commit <span className="font-mono">{commitHash.slice(0, 7)}</span>
        </p>

        <input
          ref={inputRef}
          type="text"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tag name"
          className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(tagName.trim())}
            disabled={!tagName.trim()}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Tag
          </button>
        </div>
      </div>
    </div>
  );
}
