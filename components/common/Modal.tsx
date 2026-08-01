import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Props for the shared centered modal shell. */
export interface ModalProps {
  /** Heading shown top-left. */
  title: string;
  /** Called when the close button is pressed. */
  onClose: () => void;
  /** Modal body. */
  children: ReactNode;
}

/** Dark, blurred-backdrop modal used across the studio. */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
