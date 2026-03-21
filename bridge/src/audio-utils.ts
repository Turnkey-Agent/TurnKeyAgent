/**
 * Audio utilities for Twilio ↔ Gemini Live API bridge
 *
 * Twilio sends: μ-law (G.711) 8kHz mono, base64 encoded
 * Gemini expects: PCM 16-bit LE, 16kHz mono
 * Gemini returns: PCM 16-bit LE, 24kHz mono
 */

// μ-law decompression table (ITU-T G.711)
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    const sign = mu & 0x80 ? -1 : 1;
    mu &= 0x7f;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    MULAW_DECODE_TABLE[i] = sign * sample;
  }
})();

// μ-law compression: PCM 16-bit → μ-law byte
const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

function encodeMulawSample(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_BIAS;

  let exponent = 7;
  const expMask = 0x4000;
  for (; exponent > 0; exponent--) {
    if (sample & expMask) break;
    sample <<= 1;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulawByte;
}

/**
 * Decode μ-law bytes to PCM 16-bit samples
 */
export function decodeMulaw(mulawData: Buffer): Int16Array {
  const pcm = new Int16Array(mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulawData[i]];
  }
  return pcm;
}

/**
 * Encode PCM 16-bit samples to μ-law bytes
 */
export function encodeMulaw(pcmData: Int16Array): Buffer {
  const mulaw = Buffer.alloc(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    mulaw[i] = encodeMulawSample(pcmData[i]);
  }
  return mulaw;
}

/**
 * Linear resample between sample rates.
 * Good enough for voice — no anti-aliasing filter needed at hackathon quality.
 */
export function resample(
  input: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) return input;

  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;

    if (idx + 1 < input.length) {
      output[i] = Math.round(input[idx] * (1 - frac) + input[idx + 1] * frac);
    } else {
      output[i] = input[idx] ?? 0;
    }
  }

  return output;
}

/**
 * Convert PCM Int16Array to Buffer (little-endian)
 */
export function pcmToBuffer(pcm: Int16Array): Buffer {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], i * 2);
  }
  return buf;
}

/**
 * Convert Buffer (little-endian PCM) to Int16Array
 */
export function bufferToPcm(buf: Buffer): Int16Array {
  const pcm = new Int16Array(buf.length / 2);
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = buf.readInt16LE(i * 2);
  }
  return pcm;
}

/**
 * Full pipeline: Twilio base64 μ-law 8kHz → Gemini-ready base64 PCM 16kHz
 * Resample to 16kHz for best quality with Gemini native audio
 */
export function twilioToGemini(base64Mulaw: string): string {
  const mulawBuf = Buffer.from(base64Mulaw, "base64");
  const pcm8k = decodeMulaw(mulawBuf);
  const pcm16k = resample(pcm8k, 8000, 16000);
  const buf = pcmToBuffer(pcm16k);
  return buf.toString("base64");
}

/**
 * Full pipeline: Gemini base64 PCM 24kHz → Twilio base64 μ-law 8kHz
 */
export function geminiToTwilio(base64Pcm: string): string {
  const pcmBuf = Buffer.from(base64Pcm, "base64");
  const pcm24k = bufferToPcm(pcmBuf);
  const pcm8k = resample(pcm24k, 24000, 8000);
  const mulaw = encodeMulaw(pcm8k);
  return mulaw.toString("base64");
}
