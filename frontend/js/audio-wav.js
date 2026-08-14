// Convert a recorded audio Blob (whatever MediaRecorder produced — usually
// WebM/Opus) into a 16 kHz mono 16-bit PCM WAV Blob.
//
// Why: NVIDIA Riva ASR (and most Whisper endpoints) expect linear PCM WAV,
// NOT compressed WebM/Opus. We decode the recording with the Web Audio API,
// downmix to mono, resample to 16 kHz via an OfflineAudioContext, then write
// a minimal WAV container. This runs entirely in the browser — no ffmpeg.

const TARGET_RATE = 16000;

export async function blobToWav16kMono(blob) {
  const arrayBuf = await blob.arrayBuffer();

  // Decode the compressed audio to raw PCM at its native sample rate.
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioCtx();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    decodeCtx.close?.();
  }

  // Resample + downmix to mono 16 kHz using an offline context.
  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  const pcm = rendered.getChannelData(0); // Float32 mono
  return encodeWav(pcm, TARGET_RATE);
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2; // 16-bit
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  // fmt chunk
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // audio format = PCM
  view.setUint16(22, 1, true);           // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true);              // block align
  view.setUint16(34, 16, true);          // bits per sample
  // data chunk
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples — clamp float [-1,1] to int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}
