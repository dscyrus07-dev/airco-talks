"use client";

interface Props {
  error: { code: string; message: string } | null;
  micError: string | null;
  onDismiss: () => void;
}

/** Friendly, non-technical error display. Never surfaces stack traces or keys. */
export function ErrorMessage({ error, micError, onDismiss }: Props) {
  const message = micError ?? error?.message ?? null;
  if (!message) return null;
  return (
    <div className="mx-auto w-full max-w-xl px-4" role="alert">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200">
        <p>{message}</p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="shrink-0 text-red-300 hover:text-red-100">
          ✕
        </button>
      </div>
    </div>
  );
}
