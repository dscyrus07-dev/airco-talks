"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/lib/audio-player";

/**
 * Owns AI audio playback only. The orchestrator hook feeds it PCM chunks and
 * calls `stop` on barge-in. It knows nothing about STT/LLT/WebSocket.
 */
export function useAudioPlayback() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      const player = new AudioPlayer(24000);
      player.onEnded = () => setSpeaking(false);
      playerRef.current = player;
    }
    return playerRef.current;
  }, []);

  const playChunk = useCallback((base64Pcm: string, sampleRate?: number) => {
    const player = ensurePlayer();
    player.playChunk(base64Pcm, sampleRate);
    setSpeaking(true);
  }, [ensurePlayer]);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  return { speaking, playChunk, stop };
}
