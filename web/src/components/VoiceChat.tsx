"use client";
import { useEffect, useState } from "react";
import { VoiceSessionState, getLanguage, type LanguageCode } from "@airco-talks/shared";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { MicrophoneButton } from "./MicrophoneButton";
import { VoiceWave } from "./VoiceWave";
import { StateIndicator } from "./StateIndicator";
import { LiveTranscript } from "./LiveTranscript";
import { ConversationHistory } from "./ConversationHistory";
import { SettingsPanel } from "./SettingsPanel";
import { ErrorMessage } from "./ErrorMessage";
import { VoiceEngineCard } from "./VoiceEngineCard";
import { QuickPrompts } from "./QuickPrompts";
import { FeatureBar } from "./FeatureBar";
import { AmbientBackground } from "./AmbientBackground";

// Valid Bulbul v3 speakers (verified via Sarvam API).
const VOICES = [
  "aditya", "ritu", "ashutosh", "priya", "neha", "rahul", "pooja", "rohan",
  "simran", "kavya", "amit", "dev",
];

/**
 * App shell: sidebar + header + hero (mic orb, wave, transcript) + voice
 * engine card + language presets + feature bar. All voice logic lives in
 * {@link useVoiceSession}; this component only composes the presentation.
 *
 * Two presentation modes:
 *  - Welcome mode (no messages): full hero + language presets + features.
 *  - Conversation mode (any messages/live transcript): everything marketing
 *    hides; the live translation becomes the focus with a compact orb.
 */
export function VoiceChat() {
  const session = useVoiceSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [level, setLevel] = useState(0);

  const conversationMode =
    session.messages.length > 0 ||
    session.partialTranscript.length > 0 ||
    session.aiResponseText.length > 0;

  // Poll the REAL microphone level for the waveform while listening.
  useEffect(() => {
    if (
      session.voiceState !== VoiceSessionState.LISTENING &&
      session.voiceState !== VoiceSessionState.USER_SPEAKING
    ) {
      setLevel(0);
      return;
    }
    const id = setInterval(() => setLevel(session.micActive ? session.getMicLevel() : 0), 100);
    return () => clearInterval(id);
  }, [session.voiceState, session.micActive, session]);

  const myLang = getLanguage(session.settings.myLanguage);
  const theirSetting = session.settings.theirLanguage;
  const theirIsAuto = theirSetting === "auto";
  const theirLang = theirSetting === "auto" ? null : getLanguage(theirSetting);
  const detected = session.detectedLanguage
    ? getLanguage(session.detectedLanguage as LanguageCode)
    : null;

  const connected = session.connectionStatus === "connected";

  return (
    <div className="flex min-h-screen">
      <AmbientBackground />

      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onOpenSettings={() => {
          setSettingsOpen(true);
          setNavOpen(false);
        }}
        onConnect={() => {
          if (session.voiceState === VoiceSessionState.IDLE || session.voiceState === VoiceSessionState.ERROR) {
            session.toggle();
          }
          setNavOpen(false);
        }}
        connected={connected}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <AppHeader
          connectionStatus={session.connectionStatus}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenNav={() => setNavOpen(true)}
        />

        {conversationMode ? (
          /* ── Conversation mode: live translation is the focus ───── */
          <main className="relative flex flex-1 flex-col px-4 pb-4 lg:px-8">
            <section className="flex flex-col items-center gap-3 pt-1">
              <MicrophoneButton compact state={session.voiceState} onClick={session.toggle} />
              <button
                type="button"
                onClick={session.toggle}
                className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs text-body transition duration-200 hover:border-accent/40 hover:text-strong focus-visible:ring-2 focus-visible:ring-accentSoft/60"
                aria-label={session.voiceState === VoiceSessionState.IDLE ? "Tap to speak" : "Stop listening"}
              >
                <MicGlyph />
                {session.voiceState === VoiceSessionState.IDLE ? "Tap to speak" : "Tap to stop"}
              </button>
              <StateIndicator
                state={session.voiceState}
                detectedLanguage={detected?.name}
                languageEndonym={detected?.endonym}
              />
              <LiveTranscript partial={session.partialTranscript} aiText={session.aiResponseText} />
              <ErrorMessage
                error={session.error}
                micError={session.micError}
                onDismiss={() => session.updateSettings({})}
              />
            </section>

            <ConversationHistory expanded messages={session.messages} onClear={session.clearConversation} />

            {session.latency.speechEndToFirstAudioMs ? (
              <p className="py-2 text-center text-[10px] text-faint">
                voice latency: {session.latency.speechEndToFirstAudioMs}ms
              </p>
            ) : null}
          </main>
        ) : (
          /* ── Welcome mode: full hero ────────────────────────────── */
          <main className="relative flex flex-1 flex-col px-4 pb-6 lg:px-8">
            <section className="relative flex flex-col items-center pt-6 lg:pt-10">
              <h2 className="text-center text-3xl font-bold tracking-tight text-strong sm:text-4xl lg:text-[2.6rem]">
                Speak <span className="text-gradient-hero">your</span> language. They hear theirs.
              </h2>
              <p className="mt-3 text-sm text-muted">
                {theirLang
                  ? `Two-way voice translation — you speak ${myLang.name}, they hear ${theirLang.name}`
                  : `Two-way voice translation — you speak ${myLang.name}; the customer's language is auto-detected`}
              </p>

              {/* Wave + orb composition */}
              <div className="relative mt-6 flex w-full max-w-3xl items-center justify-center">
                <VoiceWave active={session.voiceState !== VoiceSessionState.IDLE} level={level} />
                <MicrophoneButton state={session.voiceState} onClick={session.toggle} />
              </div>

              <button
                type="button"
                onClick={session.toggle}
                className="glass mt-6 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-body transition duration-200 hover:border-accent/40 hover:text-strong focus-visible:ring-2 focus-visible:ring-accentSoft/60"
                aria-label={session.voiceState === VoiceSessionState.IDLE ? "Tap to speak" : "Stop listening"}
              >
                <MicGlyph />
                {session.voiceState === VoiceSessionState.IDLE ? "Tap to speak" : "Tap to stop"}
              </button>

              <StateIndicator
                state={session.voiceState}
                detectedLanguage={detected?.name}
                languageEndonym={detected?.endonym}
              />

              <LiveTranscript partial={session.partialTranscript} aiText={session.aiResponseText} />

              <ErrorMessage
                error={session.error}
                micError={session.micError}
                onDismiss={() => session.updateSettings({})}
              />
            </section>

            {/* Voice engine card (floats right on xl) */}
            <div className="mt-8 flex justify-center xl:absolute xl:right-8 xl:top-28 xl:mt-0 xl:justify-end">
              <VoiceEngineCard />
            </div>

            <div className="mt-10">
              <QuickPrompts
                onPrompt={() => {
                  if (session.voiceState === VoiceSessionState.IDLE || session.voiceState === VoiceSessionState.ERROR) {
                    session.toggle();
                  }
                }}
                onPickPair={(my, their) => session.updateSettings({ myLanguage: my, theirLanguage: their })}
                activeMyLanguage={session.settings.myLanguage}
                activeTheirLanguage={session.settings.theirLanguage}
              />
            </div>

            <div className="mt-8">
              <FeatureBar />
            </div>

            {session.latency.speechEndToFirstAudioMs ? (
              <p className="mt-4 text-center text-[10px] text-faint">
                voice latency: {session.latency.speechEndToFirstAudioMs}ms
              </p>
            ) : null}
          </main>
        )}

        <footer className="px-6 py-4 text-center text-[11px] text-faint">
          Speech is translated live by Sarvam Saaras + Cerebras + Sarvam Bulbul. Audio is not permanently stored.
        </footer>
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={session.settings}
        voices={VOICES}
        onChange={session.updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function MicGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
