"use client";
import { useEffect, useState } from "react";
import { VoiceSessionState, getLanguage, type LanguageCode } from "@dhvani/shared";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { MicrophoneButton } from "./MicrophoneButton";
import { AudioWaveform } from "./AudioWaveform";
import { StateIndicator } from "./StateIndicator";
import { LiveTranscript } from "./LiveTranscript";
import { ConversationHistory } from "./ConversationHistory";
import { SettingsPanel } from "./SettingsPanel";
import { ErrorMessage } from "./ErrorMessage";
import { ConnectionStatus } from "./ConnectionStatus";

const VOICES = [
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan",
  "simran", "kavya", "amit", "dev", "ishita", "shreya", "anushka", "abhilash",
];

/**
 * Container component: wires the {@link useVoiceSession} hook to the visual
 * components. Visual components stay reusable and free of business logic.
 */
export function VoiceChat() {
  const session = useVoiceSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [level, setLevel] = useState(0);

  // Poll microphone level for the waveform while listening.
  useEffect(() => {
    if (
      session.voiceState !== VoiceSessionState.LISTENING &&
      session.voiceState !== VoiceSessionState.USER_SPEAKING
    ) {
      setLevel(0);
      return;
    }
    const id = setInterval(() => setLevel(session.micActive ? Math.random() * 0.6 + 0.2 : 0), 120);
    return () => clearInterval(id);
  }, [session.voiceState, session.micActive]);

  const detected = session.detectedLanguage
    ? getLanguage(session.detectedLanguage as LanguageCode)
    : null;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">Airco DHVANI AI</h1>
          <p className="text-xs text-slate-500">AI that speaks your language</p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus status={session.connectionStatus} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
            aria-label="Open settings"
          >
            Settings
          </button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="flex flex-col items-center gap-5">
          <MicrophoneButton state={session.voiceState} onClick={session.toggle} />
          <AudioWaveform state={session.voiceState} level={level} />
          <StateIndicator
            state={session.voiceState}
            detectedLanguage={detected?.name}
            languageEndonym={detected?.endonym}
          />
        </div>

        <LiveTranscript partial={session.partialTranscript} aiText={session.aiResponseText} />

        <ErrorMessage
          error={session.error}
          micError={session.micError}
          onDismiss={() => session.updateSettings({})}
        />

        <ConversationHistory messages={session.messages} onClear={session.clearConversation} />

        {session.latency.speechEndToFirstAudioMs ? (
          <p className="text-[10px] text-slate-600">
            voice latency: {session.latency.speechEndToFirstAudioMs}ms
          </p>
        ) : null}
      </section>

      <footer className="px-6 py-3 text-center text-[11px] text-slate-600">
        Voice is processed live by Sarvam Saaras + Cerebras + Sarvam Bulbul. Audio is not permanently stored.
      </footer>

      <SettingsPanel
        open={settingsOpen}
        settings={session.settings}
        voices={VOICES}
        onChange={session.updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
