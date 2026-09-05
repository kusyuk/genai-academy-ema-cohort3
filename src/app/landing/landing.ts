import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {FirebaseState} from '../services/firebase';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-landing',
  imports: [MatIconModule],
  template: `
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center text-center">
      <!-- Top Pill Badge -->
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 text-teal-800 text-xs font-semibold mb-6 border border-teal-200 shadow-2xs">
        <mat-icon class="text-teal-700 text-base">verified_user</mat-icon>
        <span>Protected Clinical Journal &bull; Gemini 3.8 Flash Grounded</span>
      </div>

      <!-- Headline -->
      <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-stone-900 max-w-4xl leading-[1.15]">
        Transforming Caregiver Notes into <span class="text-teal-700 underline decoration-teal-300 decoration-wavy decoration-2">Clinical Handover</span> Clarity.
      </h1>

      <!-- Subtitle -->
      <p class="mt-5 text-sm sm:text-base lg:text-lg text-stone-600 max-w-2xl leading-relaxed">
        <strong>EMA</strong> bridges the communication gap between family caregivers and physicians. Hands-free voice scribe, real-time safety alerts for polypharmacy conflicts, Google Tasks directives, and a 15-second longitudinal clinic handover for your doctor.
      </p>

      <!-- Auth Action Box -->
      <div class="mt-8 p-6 sm:p-8 rounded-2xl bg-white border border-stone-200 shadow-sm max-w-md w-full text-left">
        <div class="flex items-center justify-between mb-3 text-stone-900 font-bold text-sm">
          <div class="flex items-center gap-2">
            <mat-icon class="text-teal-700">lock</mat-icon>
            <span>Federated Caregiver Identity</span>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
            OAuth 2.0
          </span>
        </div>

        <p class="text-xs text-stone-500 mb-5 leading-normal">
          Zero passwords stored. Authenticate securely with Google to unlock your protected patient sanctuary.
        </p>

        @if (errorMessage()) {
          <div class="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <mat-icon class="text-sm shrink-0 mt-0.5">error_outline</mat-icon>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <button
          id="btn-landing-google-signin"
          type="button"
          (click)="handleGoogleSignIn()"
          [disabled]="isSigningIn()"
          class="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 active:scale-98 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer shadow-sm"
        >
          @if (isSigningIn()) {
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>Verifying Google Credentials...</span>
          } @else {
            <mat-icon class="text-lg">login</mat-icon>
            <span>Sign In with Google</span>
          }
        </button>

        <div class="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
          <span class="inline-flex items-center gap-1">
            <mat-icon class="text-xs text-teal-600">cloud_done</mat-icon>
            <span>Cloud Run (Asia-SE1)</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <mat-icon class="text-xs text-teal-600">security</mat-icon>
            <span>ema-clinical-vault Isolation</span>
          </span>
        </div>
      </div>

      <!-- Feature Architecture Pillars -->
      <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <!-- Pillar 1 -->
        <div class="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-teal-200 transition">
          <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
            <mat-icon class="text-xl">record_voice_over</mat-icon>
          </div>
          <h2 class="text-base font-bold text-stone-900 mb-2">Hands-Free Voice Scribe</h2>
          <p class="text-xs text-stone-600 leading-relaxed">
            Narrate observations while caring for your loved one. Gemini listens actively, asking targeted clinical questions with 1-tap quick replies.
          </p>
        </div>

        <!-- Pillar 2 -->
        <div class="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-teal-200 transition">
          <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
            <mat-icon class="text-xl">health_and_safety</mat-icon>
          </div>
          <h2 class="text-base font-bold text-stone-900 mb-2">Grounded Safety Officer</h2>
          <p class="text-xs text-stone-600 leading-relaxed">
            Observations are automatically verified against patient baseline prescriptions and allergies to catch drug interactions and adherence issues.
          </p>
        </div>

        <!-- Pillar 3 -->
        <div class="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-teal-200 transition">
          <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
            <mat-icon class="text-xl">medical_services</mat-icon>
          </div>
          <h2 class="text-base font-bold text-stone-900 mb-2">15-Second Doctor Handover</h2>
          <p class="text-xs text-stone-600 leading-relaxed">
            Physicians get an immediate high-density executive synthesis with longitudinal SVG blood pressure and glucose trend graphs and discussion targets.
          </p>
        </div>
      </div>

      <!-- Additional Challenge Integration Highlight: Google Tasks -->
      <div class="mt-8 p-5 rounded-2xl bg-sky-50/80 border border-sky-200 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <mat-icon class="text-xl">checklist_rtl</mat-icon>
          </div>
          <div>
            <h3 class="text-sm font-bold text-sky-950">Google Tasks API Integration</h3>
            <p class="text-xs text-sky-800">
              Gemini converts clinical care directives into actionable tasks with scheduled reminders synced straight to your Google account.
            </p>
          </div>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-white text-sky-900 border border-sky-300 shrink-0">
          Challenge Custom Feature
        </span>
      </div>
    </main>
  `,
})
export class Landing {
  private readonly firebaseState = inject(FirebaseState);

  readonly isSigningIn = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  async handleGoogleSignIn(): Promise<void> {
    this.isSigningIn.set(true);
    this.errorMessage.set(null);
    try {
      await this.firebaseState.signInWithGoogle();
    } catch (err: unknown) {
      console.error('Landing Google sign in error:', err);
      const msg =
        err instanceof Error ? err.message : 'Google sign-in was cancelled or failed.';
      this.errorMessage.set(msg);
    } finally {
      this.isSigningIn.set(false);
    }
  }
}
