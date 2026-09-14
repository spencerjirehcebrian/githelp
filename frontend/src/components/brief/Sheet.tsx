/**
 * A centred panel over a dimmed page.
 *
 * Both of the app's two panels are read-mostly and short-lived, so this is
 * deliberately thin: a backdrop, a title, and whatever the caller puts in it.
 * Esc is handled by the global key handler rather than here, so there is one
 * place that decides what Esc means.
 */

import type { ReactNode } from 'react';

export interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-4 pt-28 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-md rounded border border-line bg-bg p-5 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-eyebrow font-medium uppercase text-faint">{title}</h2>
        {children}
      </div>
    </div>
  );
}
