// Types + incoming-registration state — NO @twilio/... import here, so route files
// (which expo-router requires at startup) can use these WITHOUT loading the native
// Twilio SDK at launch (which crashes release builds: the native module isn't ready
// yet, so `new NativeEventEmitter(null)` throws). The SDK lives in twilio.ts and is
// loaded ONLY via dynamic import() when the user actually places a call / registers.

export type CallStatus = 'connecting' | 'ringing' | 'connected' | 'disconnected' | 'failed';

export interface ActiveCall {
  disconnect: () => void;
  mute: (on: boolean) => void;
  /** DTMF digits for IVRs («πατήστε 1 για...»). */
  sendDigits: (digits: string) => void;
  /** Route audio to the speakerphone (dirty-hands mode on a job site). */
  setSpeaker: (on: boolean) => void;
}

export type IncomingState = 'idle' | 'registering' | 'registered' | 'error';

let incomingState: { state: IncomingState; detail?: string } = { state: 'idle' };

type Listener = () => void;
const listeners = new Set<Listener>();

export function getIncomingState() {
  return incomingState;
}

export function setIncomingState(next: { state: IncomingState; detail?: string }) {
  incomingState = next;
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // a broken listener must not break state updates
    }
  }
}

/** Subscribe to registration-state changes (Home banner, Settings row). */
export function subscribeIncomingState(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
