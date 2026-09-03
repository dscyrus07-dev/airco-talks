"use client";

interface Props {
  partial: string;
  aiText: string;
}

/**
 * Secondary UI: shows the live partial transcript (while the user speaks) and
 * the streaming AI response (while the assistant replies). Kept visually
 * secondary to keep the experience voice-first.
 */
export function LiveTranscript({ partial, aiText }: Props) {
  if (!partial && !aiText) return null;
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4">
      {partial ? (
        <p className="text-center text-lg leading-relaxed text-slate-200" aria-live="polite">
          <span className="text-slate-500">You: </span>
          {partial}
        </p>
      ) : null}
      {aiText ? (
        <p className="text-center text-lg leading-relaxed text-accentSoft" aria-live="polite">
          <span className="text-slate-500">AI: </span>
          {aiText}
        </p>
      ) : null}
    </div>
  );
}
