import {Injectable, signal} from '@angular/core';

// Declare types for Web Speech API
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SpeechService {
  readonly isListening = signal<boolean>(false);
  readonly transcript = signal<string>('');
  readonly errorMessage = signal<string | null>(null);
  readonly isSupported = signal<boolean>(false);

  private recognition: ISpeechRecognition | null = null;
  private finalTranscript = '';
  private interimTranscript = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionConstructor) {
        this.isSupported.set(true);
        this.recognition = new SpeechRecognitionConstructor();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          this.interimTranscript = '';

          // Loop starting from event.resultIndex (only process new or updated chunks)
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcriptChunk = result[0]?.transcript || '';

            if (result.isFinal) {
              const trimmed = transcriptChunk.trim();
              if (trimmed) {
                // Deduplicate consecutive identical final phrases (common iOS WebKit anomaly)
                if (!this.finalTranscript.endsWith(trimmed)) {
                  this.finalTranscript = (this.finalTranscript + ' ' + trimmed).trim();
                }
              }
            } else {
              // Overwrite interim transcript with latest active hypothesis (DO NOT CONCATENATE)
              this.interimTranscript = transcriptChunk.trim();
            }
          }

          const combined = (this.finalTranscript + ' ' + this.interimTranscript)
            .replace(/\s+/g, ' ')
            .trim();

          this.transcript.set(combined);
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Speech recognition warning/error:', event.error);
          this.errorMessage.set(`Speech error: ${event.error}`);
          this.isListening.set(false);
        };

        this.recognition.onend = () => {
          this.isListening.set(false);
          // Promote any pending interim text when engine finishes
          if (this.interimTranscript) {
            const trimmed = this.interimTranscript.trim();
            if (trimmed && !this.finalTranscript.endsWith(trimmed)) {
              this.finalTranscript = (this.finalTranscript + ' ' + trimmed).trim();
            }
            this.interimTranscript = '';
            this.transcript.set(this.finalTranscript.trim());
          }
        };
      }
    }
  }

  start(): void {
    if (!this.recognition) {
      this.errorMessage.set('Speech recognition is not supported in this browser.');
      return;
    }
    this.errorMessage.set(null);
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.transcript.set('');
    try {
      this.recognition.start();
      this.isListening.set(true);
    } catch (err) {
      console.warn('Speech start error:', err);
    }
  }

  stop(): string {
    if (this.recognition && this.isListening()) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Speech stop error:', err);
      }
    }
    this.isListening.set(false);

    // Promote any trailing interim text to final transcript so zero words are dropped
    if (this.interimTranscript) {
      const trimmed = this.interimTranscript.trim();
      if (trimmed && !this.finalTranscript.endsWith(trimmed)) {
        this.finalTranscript = (this.finalTranscript + ' ' + trimmed).trim();
      }
      this.interimTranscript = '';
    }

    const fullText = this.finalTranscript.replace(/\s+/g, ' ').trim();
    this.transcript.set(fullText);
    return fullText;
  }

  toggle(): void {
    if (this.isListening()) {
      this.stop();
    } else {
      this.start();
    }
  }
}
