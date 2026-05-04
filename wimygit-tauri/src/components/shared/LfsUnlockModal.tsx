import { type LfsLock } from "../../lib";

interface LfsUnlockModalProps {
  locks: LfsLock[];
  stagedSet: Set<string>;
  modifiedSet: Set<string>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LfsUnlockModal({ locks, stagedSet, modifiedSet, onConfirm, onCancel }: LfsUnlockModalProps) {
  const hasPendingChanges = locks.some((l) => stagedSet.has(l.filename) || modifiedSet.has(l.filename));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Unlock LFS Files</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Push succeeded. You have {locks.length} LFS-locked file{locks.length !== 1 ? "s" : ""}. Do you want to unlock them?
        </p>

        {/* File table */}
        <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
          <div className="flex text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="flex-1 px-3 py-1.5">File</span>
            <span className="w-24 px-3 py-1.5 text-center shrink-0">Status</span>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {locks.map((lock) => {
              const isStaged = stagedSet.has(lock.filename);
              const isModified = modifiedSet.has(lock.filename);
              return (
                <div
                  key={lock.filename}
                  className="flex items-center border-b last:border-0 border-gray-100 dark:border-gray-700"
                >
                  <span className="flex-1 px-3 py-1.5 text-xs font-mono text-gray-800 dark:text-gray-200 truncate" title={lock.filename}>
                    {lock.filename}
                  </span>
                  <span className="w-24 px-3 py-1.5 text-center shrink-0">
                    {isStaged ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        staged
                      </span>
                    ) : isModified ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                        modified
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {hasPendingChanges && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            ⚠ Some files have pending changes and may still be in progress.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-colors"
          >
            Unlock All
          </button>
        </div>
      </div>
    </div>
  );
}
