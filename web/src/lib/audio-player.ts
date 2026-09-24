/**
 * Streams incoming linear16 PCM chunks (base64) to the speakers via the Web
 * Audio API. Chunks are scheduled back-to-back for gapless playback, and the
 * whole queue can be stopped instantly for barge-in.
 */
export class AudioPlayer {
  private context: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private playing = false;
  private gain: GainNode | null = null;
  private readonly sampleRate: number;

  /** Called when the last scheduled chunk finishes playing. */
  onEnded?: () => void;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new Context({ sampleRate: this.sampleRate });
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  /** Enqueue a base64 linear16 PCM chunk for playback. */
  playChunk(base64Pcm: string, sampleRate = this.sampleRate): void {
    const ctx = this.ensureContext();
    const float32 = base64PcmToFloat32(base64Pcm);
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32 as Float32Array<ArrayBuffer>, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain ?? ctx.destination);

    const start = Math.max(ctx.currentTime, this.nextStartTime);
    source.start(start);
    this.nextStartTime = start + buffer.duration;
    this.sources.push(source);
    this.playing = true;

    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source);
      if (this.sources.length === 0) {
        this.playing = false;
        this.nextStartTime = 0;
        this.onEnded?.();
      }
    };
  }

  /** Immediately stop all playback (barge-in). */
  stop(): void {
    for (const s of this.sources) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.playing = false;
    this.nextStartTime = 0;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  dispose(): void {
    this.stop();
    if (this.context && this.context.state !== "closed") {
      this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.gain = null;
  }
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // A network chunk can be truncated mid-sample (odd byte count); drop the
  // trailing byte so DataView reads never go out of bounds.
  const sampleCount = Math.floor(bytes.length / 2);
  if (sampleCount === 0) return new Float32Array(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true); // little-endian
    out[i] = int16 / 0x8000;
  }
  return out;
}
