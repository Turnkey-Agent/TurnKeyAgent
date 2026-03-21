/**
 * Audio utilities for Twilio ↔ Gemini Live API bridge
 *
 * Twilio sends/receives: μ-law (G.711) 8kHz mono, base64 encoded
 * Gemini accepts: PCM 16-bit LE at 8kHz/16kHz/24kHz
 * Gemini returns: PCM 16-bit LE 24kHz
 *
 * Input path:  μ-law decode → PCM 16-bit 8kHz (no resample, Gemini handles 8kHz natively)
 * Output path: PCM 24kHz → downsample 8kHz → μ-law encode
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
 * Encode PCM 16-bit samples to μ-law bytes
 */
function encodeMulaw(pcmData: Int16Array): Buffer {
  const mulaw = Buffer.alloc(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    mulaw[i] = encodeMulawSample(pcmData[i]);
  }
  return mulaw;
}

/**
 * Convert Buffer (little-endian PCM) to Int16Array
 */
function bufferToPcm(buf: Buffer): Int16Array {
  const pcm = new Int16Array(buf.length / 2);
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = buf.readInt16LE(i * 2);
  }
  return pcm;
}

/**
 * Downsample with simple low-pass averaging to prevent aliasing.
 * For 24kHz → 8kHz (3:1 ratio), average every 3 samples.
 */
function downsample(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
    }
    output[i] = Math.round(sum / (end - start));
  }
  return output;
}

/**
 * Decode μ-law bytes to PCM 16-bit samples
 */
function decodeMulaw(mulawData: Buffer): Int16Array {
  const pcm = new Int16Array(mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulawData[i]];
  }
  return pcm;
}

/**
 * Convert PCM Int16Array to Buffer (little-endian)
 */
function pcmToBuffer(pcm: Int16Array): Buffer {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], i * 2);
  }
  return buf;
}

/**
 * Twilio → Gemini: μ-law 8kHz → PCM 16-bit 8kHz (no resample)
 * Gemini Live API accepts PCM at 8kHz natively.
 */
export function twilioToGemini(base64Mulaw: string): string {
  const mulawBuf = Buffer.from(base64Mulaw, "base64");
  const pcm8k = decodeMulaw(mulawBuf);
  return pcmToBuffer(pcm8k).toString("base64");
}

/**
 * Gemini → Twilio: PCM 24kHz 16-bit LE → downsample to 8kHz → encode μ-law → base64
 */
export function geminiToTwilio(base64Pcm: string): string {
  const pcmBuf = Buffer.from(base64Pcm, "base64");
  const pcm24k = bufferToPcm(pcmBuf);
  const pcm8k = downsample(pcm24k, 24000, 8000);
  const mulaw = encodeMulaw(pcm8k);
  return mulaw.toString("base64");
}
