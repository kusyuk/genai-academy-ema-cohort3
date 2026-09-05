import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {FirebaseState} from '../services/firebase';
import {
  PatientProfile,
  DEFAULT_PATIENT_PROFILE,
  Medication,
} from '../models/clinical';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-patient-profile-modal',
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <mat-icon class="text-xl">medical_information</mat-icon>
            </div>
            <div>
              <h2 class="text-base font-bold text-slate-900 leading-tight">Patient Baseline Profile</h2>
              <p class="text-xs text-slate-500">Verified medical conditions and prescriptions grounding Gemini</p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <mat-icon class="text-lg">close</mat-icon>
          </button>
        </div>

        <!-- Body Form -->
        <div class="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          <!-- Essentials Row -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Patient Full Name</label>
              <input
                type="text"
                [(ngModel)]="profile().name"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Birth Year</label>
              <input
                type="number"
                [(ngModel)]="profile().birthYear"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Gender</label>
              <select
                [(ngModel)]="profile().gender"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <!-- Chronic Conditions -->
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Chronic Conditions</label>
            <div class="flex flex-wrap gap-1.5 mb-2">
              @for (c of profile().chronicConditions; track c.condition) {
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-medium">
                  {{ c.condition }} ({{ c.diagnosedYear }})
                </span>
              }
            </div>
            <div class="flex gap-2">
              <input
                type="text"
                #condInput
                placeholder="e.g. Asthma, Osteoarthritis"
                class="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                (click)="addCondition(condInput.value); condInput.value=''"
                class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 text-xs font-medium cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          <!-- Allergies -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Medicine & Substance Allergies</label>
            <div class="flex flex-wrap gap-1.5 mb-2">
              @for (a of profile().allergies; track a.allergen) {
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-xs font-medium">
                  <mat-icon class="text-xs">warning</mat-icon>
                  {{ a.allergen }} — {{ a.reaction }} ({{ a.severity }})
                </span>
              }
            </div>
          </div>

          <!-- Active Prescriptions Cabinet -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs font-semibold text-slate-700">Active Medication Cabinet</label>
              <span class="text-xs text-slate-400">Cross-referenced for adverse interactions</span>
            </div>
            <div class="space-y-2">
              @for (m of profile().currentMedications; track m.name; let i = $index) {
                <div class="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-slate-900 text-sm">{{ m.name }}</span>
                      <span class="px-2 py-0.5 rounded-md bg-slate-200 text-xs font-medium text-slate-700">{{ m.dosage }}</span>
                      <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/80 text-xs">{{ m.timing }}</span>
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">{{ m.purpose }} • {{ m.frequency }}</p>
                    @if (m.instructions) {
                      <p class="text-xs text-amber-800 font-medium mt-0.5 flex items-center gap-1">
                        <mat-icon class="text-xs">info</mat-icon>
                        {{ m.instructions }}
                      </p>
                    }
                  </div>
                  <button
                    type="button"
                    (click)="removeMedication(i)"
                    class="self-end sm:self-center text-slate-400 hover:text-rose-600 p-2 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                    title="Remove medication"
                  >
                    <mat-icon class="text-lg">delete_outline</mat-icon>
                  </button>
                </div>
              }
            </div>

            <!-- Add Medication Form -->
            <div class="mt-3 p-3.5 rounded-xl border border-dashed border-slate-300 bg-white grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                #medName
                placeholder="Medicine Name"
                class="px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                #medDosage
                placeholder="Dosage (e.g. 10mg)"
                class="px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                #medTiming
                placeholder="Timing (e.g. Morning)"
                class="px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                (click)="addMedication(medName.value, medDosage.value, medTiming.value); medName.value=''; medDosage.value=''; medTiming.value=''"
                class="px-3.5 py-2 min-h-[44px] rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-medium text-xs sm:text-sm cursor-pointer transition flex items-center justify-center"
              >
                + Add Medicine
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <button
            type="button"
            (click)="resetToDefault()"
            class="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Reset to Hajjah Aminah
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="close.emit()"
              class="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-medium text-xs text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="saveProfile()"
              class="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <mat-icon class="text-sm">check</mat-icon>
              <span>Save Profile</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PatientProfileModal {
  readonly firebaseState = inject(FirebaseState);
  readonly close = output<void>();

  readonly profile = signal<PatientProfile>(
    JSON.parse(JSON.stringify(this.firebaseState.activePatient())),
  );

  addCondition(condition: string) {
    if (!condition.trim()) return;
    const current = this.profile();
    current.chronicConditions.push({
      condition: condition.trim(),
      diagnosedYear: new Date().getFullYear(),
    });
    this.profile.set({...current});
  }

  addMedication(name: string, dosage: string, timing: string) {
    if (!name.trim()) return;
    const current = this.profile();
    current.currentMedications.push({
      name: name.trim(),
      dosage: dosage.trim() || '1 tab',
      timing: (timing.trim() as any) || 'Morning',
      frequency: 'Daily',
      purpose: 'Prescription maintenance',
      instructions: 'Take as prescribed.',
    });
    this.profile.set({...current});
  }

  removeMedication(index: number) {
    const current = this.profile();
    current.currentMedications.splice(index, 1);
    this.profile.set({...current});
  }

  resetToDefault() {
    this.profile.set(JSON.parse(JSON.stringify(DEFAULT_PATIENT_PROFILE)));
  }

  async saveProfile() {
    const user = this.firebaseState.currentUser();
    const p = this.profile();
    p.updatedAt = new Date().toISOString();
    this.firebaseState.activePatient.set(p);
    if (user?.uid) {
      await this.firebaseState.savePatientProfile(user.uid, p);
    }
    this.close.emit();
  }
}
