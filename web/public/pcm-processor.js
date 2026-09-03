/* eslint-disable */
// AudioWorklet processor: captures mono PCM from the microphone and posts
// 128-frame Float32 blocks to the main thread. Loaded via audioWorklet.addModule.
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const ch0 = input[0];
      if (ch0) {
        // Downmix to mono if multiple channels.
        if (input.length === 1) {
          this.port.postMessage(ch0.slice(0));
        } else {
          const mono = new Float32Array(ch0.length);
          for (let i = 0; i < ch0.length; i++) {
            let sum = 0;
            for (let c = 0; c < input.length; c++) sum += input[c][i];
            mono[i] = sum / input.length;
          }
          this.port.postMessage(mono);
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-processor", PcmProcessor);
