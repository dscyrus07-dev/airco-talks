"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioRecorder } from "@/lib/audio-recorder";

export type MicrophonePermission = "unknown" | "granted" | "denied" | "prompt";

/**
 * Owns microphone permission and the {@link AudioRecorder} lifecycle only.
 * It does NOT call the LLM, send WebSocket messages, or detect language —
 * that belongs to {@link useVoiceSession}.
 */
export function useMicrophone() {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [permission, setPermission] = useState<MicrophonePermission>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const start = useCallback(async (onChunk: (base64Pcm: string) => void) => {
    setError(null);
    try {
      const recorder = new AudioRecorder(onChunk);
      recorderRef.current = recorder;
      await recorder.start();
      setPermission("granted");
      setActive(true);
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermission("denied");
        setError("Microphone permission denied. Please allow access and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No microphone found on this device.");
      } else {
        setError(err instanceof Error ? err.message : "Could not start microphone.");
      }
      setActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setActive(false);
  }, []);

  const getLevel = useCallback(() => recorderRef.current?.getLevel() ?? 0, []);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  return { permission, error, active, start, stop, getLevel };
}
