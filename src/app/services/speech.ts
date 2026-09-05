import {Injectable, signal} from '@angular/core';

// Declare types for Web Speech API
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
          let currentText = '';
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript + ' ';
          }
          this.transcript.set(currentText.trim());
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Speech recognition warning/error:', event.error);
          this.errorMessage.set(`Speech error: ${event.error}`);
          this.isListening.set(false);
        };

        this.recognition.onend = () => {
          this.isListening.set(false);
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
    return this.transcript();
  }

  toggle(): void {
    if (this.isListening()) {
      this.stop();
    } else {
      this.start();
    }
  }
}
