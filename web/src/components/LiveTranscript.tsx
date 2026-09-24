"use client";

interface Props {
  partial: string;
  aiText: string;
}

/**
 * Secondary UI: shows the live partial transcript (while either person
 * speaks) and the streaming translation (while it is rendered in the other
 * language). Kept visually secondary to keep the experience voice-first.
 */
export function LiveTranscript({ partial, aiText }: Props) {
  if (!partial && !aiText) return null;
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4">
      {partial ? (
        <p className="text-center text-lg leading-relaxed text-body" aria-live="polite">
          <span className="text-muted">Spoken: </span>
          {partial}
        </p>
      ) : null}
      {aiText ? (
        <p className="text-center text-lg leading-relaxed text-accentSoft" aria-live="polite">
          <span className="text-muted">Translation: </span>
          {aiText}
        </p>
      ) : null}
    </div>
  );
}
