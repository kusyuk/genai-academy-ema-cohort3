import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Output,
  signal,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {FirebaseState} from '../services/firebase';
import {
  DEFAULT_PATIENT_PROFILE,
  PatientProfile,
} from '../models/clinical';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-onboarding-modal',
  imports: [MatIconModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-x-hidden overflow-y-auto">
      <div class="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xl w-[94vw] sm:w-full max-w-lg sm:max-w-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        <!-- Top Progress Header -->
        <div class="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {{ currentStep() }}
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-stone-900">
                @if (currentStep() === 1) { Welcome to EMA }
                @else if (currentStep() === 2) { Choose Starting Patient Profile }
                @else { Interface Quick Tour }
              </h2>
              <p class="text-xs text-stone-500">Step {{ currentStep() }} of 3 • First-Time Setup</p>
            </div>
          </div>

          <!-- Step Indicators -->
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full transition-all" [class.bg-teal-700]="currentStep() >= 1" [class.bg-stone-200]="currentStep() < 1"></span>
            <span class="w-2.5 h-2.5 rounded-full transition-all" [class.bg-teal-700]="currentStep() >= 2" [class.bg-stone-200]="currentStep() < 2"></span>
            <span class="w-2.5 h-2.5 rounded-full transition-all" [class.bg-teal-700]="currentStep() >= 3" [class.bg-stone-200]="currentStep() < 3"></span>
          </div>
        </div>

        <!-- Step Body -->
        <div class="p-4 sm:p-8 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
          
          <!-- STEP 1: Welcome & 3 Powers -->
          @if (currentStep() === 1) {
            <div class="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
              <div class="text-center max-w-lg mx-auto space-y-2">
                <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center mx-auto shadow-xs">
                  <mat-icon class="text-2xl sm:text-3xl">local_hospital</mat-icon>
                </div>
                <h3 class="text-base sm:text-xl font-bold text-stone-900 leading-snug">Your AI-Powered Elderly Care Companion</h3>
                <p class="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  EMA is built specifically for caregivers caring for elderly loved ones with chronic conditions, bridging daily home observations with professional clinic visits.
                </p>
              </div>

              <!-- 3 Core Powers Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1 sm:pt-2">
                <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-left">
                  <div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                    <mat-icon class="text-lg">record_voice_over</mat-icon>
                  </div>
                  <h4 class="text-xs font-bold text-stone-900">Hands-Free Scribe</h4>
                  <p class="text-[11px] text-stone-600 leading-snug">
                    Narrate symptoms, food, or vitals hands-free. Gemini clarifies missing context compassionately.
                  </p>
                </div>

                <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-left">
                  <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                    <mat-icon class="text-lg">health_and_safety</mat-icon>
                  </div>
                  <h4 class="text-xs font-bold text-stone-900">Medicine Safety</h4>
                  <p class="text-[11px] text-stone-600 leading-snug">
                    Automatically verifies observations against verified baseline prescriptions to catch missed-meal conflicts.
                  </p>
                </div>

                <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-left">
                  <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                    <mat-icon class="text-lg">medical_services</mat-icon>
                  </div>
                  <h4 class="text-xs font-bold text-stone-900">Doctor Handover</h4>
                  <p class="text-[11px] text-stone-600 leading-snug">
                    Synthesizes weeks of observations and vitals trends into a rapid brief for busy clinic visits.
                  </p>
                </div>
              </div>
            </div>
          }

          <!-- STEP 2: Choose Patient Profile Setup -->
          @if (currentStep() === 2) {
            <div class="space-y-4 animate-in fade-in duration-150">
              <div class="text-left space-y-1">
                <h3 class="text-base font-bold text-stone-900">Select How You Want to Begin</h3>
                <p class="text-xs text-stone-500">
                  You can start with our realistic sample patient to test the AI immediately, or configure your own family member.
                </p>
              </div>

              <!-- Option Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <!-- Option A: Sample Hajjah Aminah (Recommended) -->
                <div
                  (click)="selectedMode.set('sample')"
                  class="p-5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between text-left space-y-3"
                  [class.border-teal-700]="selectedMode() === 'sample'"
                  [class.bg-teal-50/40]="selectedMode() === 'sample'"
                  [class.border-stone-200]="selectedMode() !== 'sample'"
                  [class.bg-white]="selectedMode() !== 'sample'"
                >
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800">
                        ⚡ Recommended for Demo
                      </span>
                      @if (selectedMode() === 'sample') {
                        <mat-icon class="text-teal-700 text-lg">check_circle</mat-icon>
                      }
                    </div>
                    <h4 class="text-sm font-bold text-stone-900">Sample Patient: Hajjah Aminah</h4>
                    <p class="text-xs text-stone-600 leading-relaxed">
                      72-year-old mother managing Type 2 Diabetes and Hypertension with Amlodipine and Metformin.
                    </p>
                    <div class="p-2.5 rounded-xl bg-white border border-teal-200 text-[11px] text-teal-900 space-y-1">
                      <p class="font-bold flex items-center gap-1">
                        <mat-icon class="text-xs text-teal-700">insights</mat-icon>
                        Includes Past Clinical Entries
                      </p>
                      <p class="text-stone-600">
                        Pre-populates 4 clinical journal entries with BP &amp; glucose trends for instant Doctor Consultation Handover testing.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Option B: Custom Patient -->
                <div
                  (click)="selectedMode.set('custom')"
                  class="p-5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between text-left space-y-3"
                  [class.border-teal-700]="selectedMode() === 'custom'"
                  [class.bg-teal-50/40]="selectedMode() === 'custom'"
                  [class.border-stone-200]="selectedMode() !== 'custom'"
                  [class.bg-white]="selectedMode() !== 'custom'"
                >
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700">
                        ✍️ Custom Setup
                      </span>
                      @if (selectedMode() === 'custom') {
                        <mat-icon class="text-teal-700 text-lg">check_circle</mat-icon>
                      }
                    </div>
                    <h4 class="text-sm font-bold text-stone-900">Create My Loved One's Profile</h4>
                    <p class="text-xs text-stone-600 leading-relaxed">
                      Enter your relative's name, age, primary chronic conditions, and active prescriptions.
                    </p>
                    <p class="text-[11px] text-stone-400">
                      Starts with a clean clinical journal for real home care.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Custom Patient Form (Revealed if custom selected) -->
              @if (selectedMode() === 'custom') {
                <div class="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 text-left animate-in fade-in duration-150">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-stone-700 mb-1">Patient Name</label>
                      <input
                        type="text"
                        [ngModel]="customName()"
                        (ngModelChange)="customName.set($event)"
                        placeholder="e.g. Robert Tan"
                        class="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-stone-700 mb-1">Birth Year</label>
                      <input
                        type="number"
                        [ngModel]="customBirthYear()"
                        (ngModelChange)="customBirthYear.set($event)"
                        placeholder="e.g. 1952"
                        class="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-stone-700 mb-1">Chronic Conditions (comma separated)</label>
                    <input
                      type="text"
                      [ngModel]="customConditions()"
                      (ngModelChange)="customConditions.set($event)"
                      placeholder="e.g. Hypertension, Osteoarthritis"
                      class="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-stone-700 mb-1">Daily Medications (name &amp; timing)</label>
                    <input
                      type="text"
                      [ngModel]="customMedications()"
                      (ngModelChange)="customMedications.set($event)"
                      placeholder="e.g. Amlodipine 5mg (Morning with food)"
                      class="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900"
                    />
                  </div>
                </div>
              }
            </div>
          }

          <!-- STEP 3: Interface Quick Tour -->
          @if (currentStep() === 3) {
            <div class="space-y-5 text-left animate-in fade-in duration-150">
              <div class="space-y-1">
                <h3 class="text-base font-bold text-stone-900">Quick 10-Second Orientation</h3>
                <p class="text-xs text-stone-500">Here are the 3 main interaction areas in your clinical dashboard:</p>
              </div>

              <div class="space-y-3">
                <div class="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                  <div class="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-stone-900">Patient Baseline Ribbon (Top)</h4>
                    <p class="text-[11px] text-stone-600 mt-0.5">
                      Displays target blood pressure, glucose ranges, and active medications. Tap "Edit Baseline" anytime to adjust prescriptions.
                    </p>
                  </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                  <div class="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-stone-900">Caregiver Scribe Chat Room (Center)</h4>
                    <p class="text-[11px] text-stone-600 mt-0.5">
                      Use the hands-free mic or type notes. Gemini cross-references baseline medications and asks follow-up safety questions with 1-tap quick replies.
                    </p>
                  </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-3">
                  <div class="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-stone-900">Doctor Consultation Handover (Header Switcher)</h4>
                    <p class="text-[11px] text-stone-600 mt-0.5">
                      Switch mode in the top navbar before doctor appointments to see the synthesized longitudinal report, SVG vitals trend charts, and discussion points.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          }

        </div>

        <!-- Footer Actions -->
        <div class="p-3.5 sm:p-5 border-t border-stone-100 flex items-center justify-between bg-stone-50/80 shrink-0 gap-2">
          <div>
            @if (currentStep() > 1) {
              <button
                type="button"
                (click)="currentStep.set(currentStep() === 3 ? 2 : 1)"
                class="px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                ← Back
              </button>
            }
          </div>

          <div class="flex items-center gap-2">
            @if (currentStep() === 1) {
              <button
                type="button"
                (click)="currentStep.set(2)"
                class="px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-98 transition flex items-center gap-1.5"
              >
                <span>Continue</span>
                <mat-icon class="text-sm">arrow_forward</mat-icon>
              </button>
            } @else if (currentStep() === 2) {
              <button
                type="button"
                (click)="applyProfileSelection()"
                [disabled]="isSaving()"
                class="px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-98 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                @if (isSaving()) {
                  <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Configuring Profile...</span>
                } @else {
                  <span class="sm:hidden">Confirm &amp; Tour</span>
                  <span class="hidden sm:inline">Confirm &amp; Tour Interface</span>
                  <mat-icon class="text-sm">arrow_forward</mat-icon>
                }
              </button>
            } @else {
              <button
                type="button"
                (click)="finishOnboarding()"
                class="px-4 sm:px-6 py-2.5 min-h-[44px] rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition flex items-center gap-1.5"
              >
                <mat-icon class="text-sm">check_circle</mat-icon>
                <span class="sm:hidden">Enter EMA</span>
                <span class="hidden sm:inline">Enter EMA Clinical Sanctuary</span>
              </button>
            }
          </div>
        </div>

      </div>
    </div>
  `,
})
export class OnboardingModal {
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  private readonly firebaseState = inject(FirebaseState);

  readonly currentStep = signal<1 | 2 | 3>(1);
  readonly selectedMode = signal<'sample' | 'custom'>('sample');
  readonly isSaving = signal<boolean>(false);

  // Custom fields
  readonly customName = signal<string>('Robert Tan');
  readonly customBirthYear = signal<number>(1951);
  readonly customConditions = signal<string>('Hypertension, Mild Osteoarthritis');
  readonly customMedications = signal<string>('Amlodipine 5mg (Morning with food)');

  async applyProfileSelection(): Promise<void> {
    const user = this.firebaseState.currentUser();
    if (!user) {
      this.currentStep.set(3);
      return;
    }

    this.isSaving.set(true);
    try {
      if (this.selectedMode() === 'sample') {
        // Save Hajjah Aminah profile
        await this.firebaseState.savePatientProfile(user.uid, {
          ...DEFAULT_PATIENT_PROFILE,
          primaryCaregiverUid: user.uid,
        });
        // Seed 4 realistic past clinical entries for rich Doctor Consultation Handover testing
        await this.firebaseState.seedSampleHistoricalEntries(user.uid);
      } else {
        // Parse custom conditions and medications
        const conditions = this.customConditions()
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => ({ condition: c, diagnosedYear: 2020 }));

        const medications = this.customMedications()
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
          .map((m) => ({
            name: m,
            dosage: 'Standard',
            frequency: 'Once daily',
            timing: 'Morning' as const,
            purpose: 'Management',
            instructions: 'Take with water after breakfast.',
          }));

        const customProfile: PatientProfile = {
          id: 'patient_custom_' + Date.now(),
          name: this.customName().trim() || 'My Loved One',
          birthYear: this.customBirthYear() || 1952,
          gender: 'other',
          primaryCaregiverUid: user.uid,
          chronicConditions: conditions,
          allergies: [],
          currentMedications: medications,
          surgicalHistory: [],
          baselineVitals: {
            targetBpSystolic: 130,
            targetBpDiastolic: 80,
            fastingBloodSugarRange: '5.0 - 7.0 mmol/L',
          },
          updatedAt: new Date().toISOString(),
        };

        await this.firebaseState.savePatientProfile(user.uid, customProfile);
      }

      this.currentStep.set(3);
    } catch (err) {
      console.error('Failed to configure profile during onboarding:', err);
      this.currentStep.set(3);
    } finally {
      this.isSaving.set(false);
    }
  }

  finishOnboarding(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ema_onboarding_completed', 'true');
    }
    this.completed.emit();
    this.close.emit();
  }
}
