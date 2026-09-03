/**
 * Microphone capture → 16 kHz mono 16-bit PCM → base64 chunks.
 *
 * Uses an AudioWorklet (public/pcm-processor.js) for low-latency capture.
 * If the browser forces a different AudioContext sample rate, samples are
 * linearly resampled to 16 kHz before encoding, because Sarvam STT requires
 * 16 kHz linear16.
 */
export type AudioChunkHandler = (base64Pcm: string) => void;

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // ~100ms at 16kHz

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private buffer: Float32Array = new Float32Array(0);
  private active = false;

  constructor(private readonly onChunk: AudioChunkHandler) {}

  get isActive(): boolean {
    return this.active;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });

    const Context = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new Context({ sampleRate: TARGET_SAMPLE_RATE });
    await this.context.audioWorklet.addModule("/pcm-processor.js");

    const source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "pcm-processor");
    source.connect(this.worklet);
    // Do NOT connect worklet to destination — we don't want to play mic back.

    this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.accumulate(e.data);
    };
    this.active = true;
  }

  /** Current input level (0..1) for the barge-in detector / waveform. */
  getLevel(): number {
    if (!this.worklet || !this.active) return 0;
    // Approximate level from the latest buffered samples.
    let max = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const v = Math.abs(this.buffer[i] ?? 0);
      if (v > max) max = v;
    }
    return max;
  }

  stop(): void {
    this.active = false;
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.worklet = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.context && this.context.state !== "closed") {
      this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.buffer = new Float32Array(0);
  }

  private accumulate(samples: Float32Array): void {
    const rate = this.context?.sampleRate ?? TARGET_SAMPLE_RATE;
    const atTarget = rate === TARGET_SAMPLE_RATE ? samples : resample(samples, rate, TARGET_SAMPLE_RATE);
    const merged = concatFloat32(this.buffer, atTarget);
    let offset = 0;
    while (merged.length - offset >= CHUNK_SAMPLES) {
      const chunk = merged.subarray(offset, offset + CHUNK_SAMPLES);
      this.onChunk(float32ToBase64Pcm(chunk));
      offset += CHUNK_SAMPLES;
    }
    this.buffer = merged.subarray(offset);
  }
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = toRate / fromRate;
  const outLen = Math.floor(input.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIndex = i / ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, input.length - 1);
    const frac = srcIndex - low;
    out[i] = (input[low] ?? 0) * (1 - frac) + (input[high] ?? 0) * frac;
  }
  return out;
}

function float32ToBase64Pcm(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  // Int16Array → little-endian bytes → base64.
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary);
}
