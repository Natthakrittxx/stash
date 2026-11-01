"use client";

import { useLayoutEffect, useRef } from "react";

// A native modal <dialog>, so the browser traps focus, makes the page behind it
// inert, and turns Esc into a close. Mounted once per opening; a layout effect so
// it is open before the form's own effect puts the cursor in the field. `locked`
// keeps it open until the step inside says otherwise.
export function Modal({
  labelledBy,
  onClose,
  locked = false,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set on pointerdown, so a text selection dragged out of a field and
  // released on the backdrop doesn't read as a backdrop click.
  const downOnBackdrop = useRef(false);

  useLayoutEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      // Esc closes the dialog natively; this hands that close to React, which
      // keeps the draft and returns focus. Unmounting fires no close event.
      // Chrome lets a second Esc past onCancel, so a locked one reopens.
      onClose={() => (locked ? ref.current?.showModal() : onClose())}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) =>
        !locked &&
        downOnBackdrop.current &&
        e.target === e.currentTarget &&
        onClose()
      }
      className="bg-bg text-ink border-border mx-auto mt-[12vh] max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border p-0 shadow-lg backdrop:bg-black/40"
    >
      {children}
    </dialog>
  );
}
