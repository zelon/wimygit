import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DiffLineCtxMenuProps {
  x: number;
  y: number;
  staged: boolean;
  onStageBlock: () => void;
  onStageLine: () => void;
  onHoverItem: (item: "block" | "line" | null) => void;
  onClose: () => void;
}

export function DiffLineCtxMenu({
  x, y, staged, onStageBlock, onStageLine, onHoverItem, onClose,
}: DiffLineCtxMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newTop = y;
      let newLeft = x;
      if (y + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height - 4;
      if (x + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width - 4;
      if (newTop !== y || newLeft !== x) setPos({ top: newTop, left: newLeft });
    }
  }, [x, y]);

  const verb = staged ? "Unstage" : "Stage";
  const btnClass = "w-full text-left px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between";

  const handleClose = () => {
    onHoverItem(null);
    onClose();
  };

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={handleClose}
        onContextMenu={(e) => { e.preventDefault(); handleClose(); }}
      />
      <div
        ref={menuRef}
        style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 text-sm min-w-[180px]"
      >
        <button
          className={btnClass}
          onMouseEnter={() => onHoverItem("block")}
          onMouseLeave={() => onHoverItem(null)}
          onClick={() => { onHoverItem(null); onStageBlock(); onClose(); }}
        >
          <span>{verb} this block</span>
        </button>
        <button
          className={btnClass}
          onMouseEnter={() => onHoverItem("line")}
          onMouseLeave={() => onHoverItem(null)}
          onClick={() => { onHoverItem(null); onStageLine(); onClose(); }}
        >
          <span>{verb} this line</span>
        </button>
      </div>
    </>,
    document.body
  );
}
