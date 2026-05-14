// Minimal local types — avoids reliance on the optional global SpeechRecognition DOM types
export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface AppSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface AppSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

export interface AppSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: AppSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: AppSpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function createRecognition(): AppSpeechRecognition | null {
  if (!isSpeechSupported()) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR() as AppSpeechRecognition;
  r.lang = 'el-GR';
  r.continuous = true; // session continues until user presses stop
  r.interimResults = true;
  return r;
}
