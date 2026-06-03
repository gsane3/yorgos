// Client-only: mixes the local microphone and the remote party's audio of a
// WebRTC call into one track and records it with MediaRecorder.
//
// Best-effort and fully guarded: any failure (unsupported browser — notably
// some iOS WKWebView contexts — blocked AudioContext, missing tracks) leaves
// the live call completely untouched and simply yields no recording, so the
// caller falls back to the metadata-only brief. NEVER throws into call logic.

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof AudioContext !== 'undefined') return AudioContext;
  const w = window as unknown as { webkitAudioContext?: AudioContextCtor };
  return w.webkitAudioContext ?? null;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // isTypeSupported can throw on some engines — keep probing.
    }
  }
  return ''; // supported, but let the browser pick a default container
}

/** True when this browser can mix + record call audio. */
export function isCallRecordingSupported(): boolean {
  return pickMimeType() !== null && getAudioContextCtor() !== null;
}

/** File extension matching a recorder mime type, for OpenAI format inference. */
export function recordingFileName(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'call.mp4';
  if (mimeType.includes('ogg')) return 'call.ogg';
  return 'call.webm';
}

export class CallRecorder {
  private ctx: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private mimeType = '';
  private started = false;

  /** Begins recording. Returns true if recording actually started. */
  start(remoteStream: MediaStream | null, localStream: MediaStream | null): boolean {
    try {
      const mt = pickMimeType();
      if (mt === null) return false;
      const Ctx = getAudioContextCtor();
      if (!Ctx) return false;

      const ctx = new Ctx();
      // Resume in case the autoplay policy left it suspended (the call started
      // from a user gesture, so this normally succeeds immediately).
      ctx.resume?.().catch(() => {});

      const dest = ctx.createMediaStreamDestination();
      let connected = 0;
      for (const s of [remoteStream, localStream]) {
        if (s && s.getAudioTracks().length > 0) {
          try {
            ctx.createMediaStreamSource(s).connect(dest);
            connected += 1;
          } catch {
            // a non-audio or already-ended stream — skip it
          }
        }
      }
      if (connected === 0) {
        ctx.close().catch(() => {});
        return false;
      }

      const recorder = mt
        ? new MediaRecorder(dest.stream, { mimeType: mt })
        : new MediaRecorder(dest.stream);
      this.chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      recorder.start();

      this.ctx = ctx;
      this.recorder = recorder;
      this.mimeType = recorder.mimeType || mt || 'audio/webm';
      this.started = true;
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  get active(): boolean {
    return this.started;
  }

  get mediaType(): string {
    return this.mimeType || 'audio/webm';
  }

  /** Stops and returns the recorded audio blob (or null on any failure). */
  async stop(): Promise<Blob | null> {
    const recorder = this.recorder;
    if (!this.started || !recorder) {
      this.cleanup();
      return null;
    }
    const chunks = this.chunks;
    const mimeType = this.mimeType;
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        recorder.onstop = () => {
          try {
            resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null);
          } catch {
            resolve(null);
          }
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else resolve(null);
      } catch {
        resolve(null);
      }
    });
    this.cleanup();
    return blob;
  }

  private cleanup(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      // ignore
    }
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.recorder = null;
    this.ctx = null;
    this.chunks = [];
    this.started = false;
  }
}
