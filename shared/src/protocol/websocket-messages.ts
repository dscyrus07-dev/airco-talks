/**
 * Typed WebSocket protocol between the browser (client) and the backend.
 *
 * Every message on the wire is a discriminated union member tagged by `type`.
 * The backend validates every incoming message with Zod before acting on it
 * (never trust external input). Outgoing messages are also typed so the
 * frontend can narrow safely.
 */
import { z } from "zod";
import { LanguageCodeSchema, LanguageSettingSchema } from "../languages/index.js";

// ── Client → Server ──────────────────────────────────────────

/**
 * Start a translation session.
 *
 * myLanguage is the device holder's language (always a fixed code).
 * theirLanguage is the other person's language — either a fixed code or
 * "auto", in which case the system detects the customer's language per
 * utterance and remembers it for translating the holder's replies.
 */
export const StartSessionMessage = z.object({
  type: z.literal("start_session"),
  sessionId: z.string().uuid().optional(),
  /** Language of the device holder (translated INTO theirLanguage). */
  myLanguage: LanguageCodeSchema,
  /** Language of the other person, or "auto" to detect it per utterance. */
  theirLanguage: LanguageSettingSchema,
  /** Preferred TTS voice override (empty = provider default for language). */
  voice: z.string().optional(),
});
export type StartSessionMessage = z.infer<typeof StartSessionMessage>;

/** Raw PCM audio chunk, base64-encoded (16-bit mono at the negotiated sample rate). */
export const AudioChunkMessage = z.object({
  type: z.literal("audio_chunk"),
  sessionId: z.string().uuid(),
  /** base64-encoded PCM bytes. */
  data: z.string().min(1),
});
export type AudioChunkMessage = z.infer<typeof AudioChunkMessage>;

export const StopSessionMessage = z.object({
  type: z.literal("stop_session"),
  sessionId: z.string().uuid(),
});
export type StopSessionMessage = z.infer<typeof StopSessionMessage>;

/** Barge-in: user started speaking while AI was talking. */
export const InterruptMessage = z.object({
  type: z.literal("interrupt"),
  sessionId: z.string().uuid(),
});
export type InterruptMessage = z.infer<typeof InterruptMessage>;

/** Change the language pair or voice mid-session. */
export const UpdateConfigMessage = z.object({
  type: z.literal("update_config"),
  sessionId: z.string().uuid(),
  myLanguage: LanguageCodeSchema.optional(),
  theirLanguage: LanguageSettingSchema.optional(),
  voice: z.string().optional(),
});
export type UpdateConfigMessage = z.infer<typeof UpdateConfigMessage>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  StartSessionMessage,
  AudioChunkMessage,
  StopSessionMessage,
  InterruptMessage,
  UpdateConfigMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Server → Client ──────────────────────────────────────────

/**
 * Which side of the conversation a text belongs to:
 *  - "my"    → the device holder spoke it / hears it
 *  - "their" → the customer spoke it / hears it
 * Spoken texts are tagged with the speaker's side; translations with the
 * hearer's side. The UI uses this to route texts into the right panel.
 */
export const ConversationSideSchema = z.enum(["my", "their"]);
export type ConversationSide = z.infer<typeof ConversationSideSchema>;

export const SessionStartedMessage = z.object({
  type: z.literal("session_started"),
  sessionId: z.string().uuid(),
});
export type SessionStartedMessage = z.infer<typeof SessionStartedMessage>;

export const TranscriptPartialMessage = z.object({
  type: z.literal("transcript_partial"),
  sessionId: z.string().uuid(),
  text: z.string(),
  language: LanguageCodeSchema,
  /** Side of the person currently speaking. */
  side: ConversationSideSchema,
});
export type TranscriptPartialMessage = z.infer<typeof TranscriptPartialMessage>;

export const TranscriptFinalMessage = z.object({
  type: z.literal("transcript_final"),
  sessionId: z.string().uuid(),
  text: z.string(),
  language: LanguageCodeSchema,
  confidence: z.number().min(0).max(1),
  /** Side of the person who spoke this utterance. */
  side: ConversationSideSchema,
});
export type TranscriptFinalMessage = z.infer<typeof TranscriptFinalMessage>;

export const LanguageDetectedMessage = z.object({
  type: z.literal("language_detected"),
  sessionId: z.string().uuid(),
  language: LanguageCodeSchema,
  confidence: z.number().min(0).max(1),
});
export type LanguageDetectedMessage = z.infer<typeof LanguageDetectedMessage>;

export const AiResponseStartedMessage = z.object({
  type: z.literal("ai_response_started"),
  sessionId: z.string().uuid(),
  /** Side that will HEAR this translation (opposite of the speaker). */
  side: ConversationSideSchema,
});
export type AiResponseStartedMessage = z.infer<typeof AiResponseStartedMessage>;

export const AiResponseChunkMessage = z.object({
  type: z.literal("ai_response_chunk"),
  sessionId: z.string().uuid(),
  text: z.string(),
});
export type AiResponseChunkMessage = z.infer<typeof AiResponseChunkMessage>;

export const AiResponseCompletedMessage = z.object({
  type: z.literal("ai_response_completed"),
  sessionId: z.string().uuid(),
  text: z.string(),
  language: LanguageCodeSchema,
  /** Side that heard this translation. */
  side: ConversationSideSchema,
});
export type AiResponseCompletedMessage = z.infer<typeof AiResponseCompletedMessage>;

/** base64-encoded PCM audio chunk for playback. */
export const AudioChunkOutMessage = z.object({
  type: z.literal("audio_chunk"),
  sessionId: z.string().uuid(),
  data: z.string().min(1),
  /** Sample rate of the audio, so the client can build the right AudioContext. */
  sampleRate: z.number().int().positive(),
});
export type AudioChunkOutMessage = z.infer<typeof AudioChunkOutMessage>;

export const AiSpeechEndedMessage = z.object({
  type: z.literal("ai_speech_ended"),
  sessionId: z.string().uuid(),
});
export type AiSpeechEndedMessage = z.infer<typeof AiSpeechEndedMessage>;

/**
 * Turn relay state: whose turn it is to speak next. The orchestrator locks
 * the conversation to one side at a time (customer speaks → translation plays
 * → holder's turn → translation plays → customer's turn). `null` means the
 * floor is open (session start, or auto-released after inactivity).
 */
export const TurnChangedMessage = z.object({
  type: z.literal("turn_changed"),
  sessionId: z.string().uuid(),
  turn: z.union([ConversationSideSchema, z.null()]),
});
export type TurnChangedMessage = z.infer<typeof TurnChangedMessage>;

export const StateChangedMessage = z.object({
  type: z.literal("state_changed"),
  sessionId: z.string().uuid(),
  state: z.string(),
});
export type StateChangedMessage = z.infer<typeof StateChangedMessage>;

export const LatencyMessage = z.object({
  type: z.literal("latency"),
  sessionId: z.string().uuid(),
  /** milliseconds from speech-end to first AI audio. */
  speechEndToFirstAudioMs: z.number().int().nonnegative().optional(),
  llmFirstTokenMs: z.number().int().nonnegative().optional(),
  ttsFirstAudioMs: z.number().int().nonnegative().optional(),
});
export type LatencyMessage = z.infer<typeof LatencyMessage>;

export const ErrorMessage = z.object({
  type: z.literal("error"),
  sessionId: z.string().uuid().optional(),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean().default(true),
});
export type ErrorMessage = z.infer<typeof ErrorMessage>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  SessionStartedMessage,
  TranscriptPartialMessage,
  TranscriptFinalMessage,
  LanguageDetectedMessage,
  AiResponseStartedMessage,
  AiResponseChunkMessage,
  AiResponseCompletedMessage,
  AudioChunkOutMessage,
  AiSpeechEndedMessage,
  TurnChangedMessage,
  StateChangedMessage,
  LatencyMessage,
  ErrorMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseClientMessage(raw: unknown): ClientMessage {
  return ClientMessageSchema.parse(raw);
}

export function isServerMessage(value: unknown): value is ServerMessage {
  return ServerMessageSchema.safeParse(value).success;
}
