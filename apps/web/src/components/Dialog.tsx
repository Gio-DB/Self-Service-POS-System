import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ title, onClose, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby="app-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <header className="dialog-header">
          <h2 id="app-dialog-title">{title}</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
