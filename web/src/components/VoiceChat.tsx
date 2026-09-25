"use client";
import { useState } from "react";
import { VoiceSessionState, getLanguage, type ConversationSide, type LanguageCode } from "@airco-talks/shared";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { ConversationPanels } from "./ConversationPanels";
import { StateIndicator } from "./StateIndicator";
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
 * App shell: sidebar + header + two-panel conversation (You / Customer, each
 * with its own mic) + language presets + feature bar. All voice logic lives
 * in {@link useVoiceSession}; this component only composes the presentation.
 */
export function VoiceChat() {
  const session = useVoiceSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const conversationMode =
    session.messages.length > 0 ||
    session.partialTranscript.length > 0 ||
    session.aiResponseText.length > 0;

  const myLang = getLanguage(session.settings.myLanguage);
  const theirSetting = session.settings.theirLanguage;
  const theirIsAuto = theirSetting === "auto";
  const theirLang = theirSetting === "auto" ? null : getLanguage(theirSetting);
  const detected = session.detectedLanguage
    ? getLanguage(session.detectedLanguage as LanguageCode)
    : null;

  // Highlight the panel of whoever is talking, or the panel hearing the
  // translation while it plays.
  const activeSide: ConversationSide | null =
    session.voiceState === VoiceSessionState.AI_SPEAKING
      ? session.aiSide
      : session.voiceState === VoiceSessionState.USER_SPEAKING || session.partialTranscript
        ? session.partialSide
        : null;

  const connected = session.connectionStatus === "connected";
  const theirLabel = theirLang ? theirLang.endonym : "Auto-detect";

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

        <main className="relative flex flex-1 flex-col px-4 pb-6 lg:px-8">
          {!conversationMode ? (
            <section className="relative flex flex-col items-center pt-4 lg:pt-8">
              <h2 className="text-center text-3xl font-bold tracking-tight text-strong sm:text-4xl lg:text-[2.6rem]">
                Speak <span className="text-gradient-hero">your</span> language. They hear theirs.
              </h2>
              <p className="mt-3 text-sm text-muted">
                {theirLang
                  ? `Two-way voice translation — you speak ${myLang.name}, they hear ${theirLang.name}`
                  : `Two-way voice translation — you speak ${myLang.name}; the customer's language is auto-detected`}
              </p>
            </section>
          ) : null}

          <div className={conversationMode ? "mt-2" : "mt-6"}>
            <ConversationPanels
              voiceState={session.voiceState}
              onMicClick={session.toggle}
              messages={session.messages}
              myLanguageEndonym={myLang.endonym}
              theirLanguageLabel={theirLabel}
              partial={session.partialTranscript}
              partialSide={session.partialSide}
              aiText={session.aiResponseText}
              aiSide={session.aiSide}
              activeSide={activeSide}
              onClear={session.clearConversation}
            />
          </div>

          <div className="mt-4 flex flex-col items-center gap-3">
            <StateIndicator
              state={session.voiceState}
              detectedLanguage={detected?.name}
              languageEndonym={detected?.endonym}
            />
            <ErrorMessage
              error={session.error}
              micError={session.micError}
              onDismiss={() => session.updateSettings({})}
            />
            {session.latency.speechEndToFirstAudioMs ? (
              <p className="text-center text-[10px] text-faint">
                voice latency: {session.latency.speechEndToFirstAudioMs}ms
              </p>
            ) : null}
          </div>

          {!conversationMode ? (
            <>
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
            </>
          ) : null}
        </main>

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
