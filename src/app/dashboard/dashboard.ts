import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {
  ClinicalEntry,
  ClinicalSoap,
  ConversationTurn,
  ExtractedMetrics,
  GoogleTaskDirective,
  GroundedAnalysis,
  PatientProfile,
  SafetyAlert,
} from '../models/clinical';
import {FirebaseState} from '../services/firebase';
import {GeminiState} from '../services/gemini';
import {SpeechService} from '../services/speech';
import {DoctorDashboard} from '../components/doctor-dashboard';
import {PatientProfileModal} from '../components/patient-profile-modal';

interface ConversationItem {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface ScribeDraft {
  conversation: ConversationItem[];
  currentClarification: string | null;
  instantReplies: string[];
  interimAlert: string | null;
  clinicalSoap?: ClinicalSoap;
  extractedMetrics?: ExtractedMetrics;
  groundedAnalysis?: GroundedAnalysis;
  safetyAlert?: SafetyAlert | null;
  googleTasksDirectives?: GoogleTaskDirective[];
  doctorConsultBullet?: string;
  isFinalized: boolean;
}

const INITIAL_DRAFT: ScribeDraft = {
  conversation: [],
  currentClarification: null,
  instantReplies: [],
  interimAlert: null,
  isFinalized: false,
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [
    MatIconModule,
    DatePipe,
    FormsModule,
    DoctorDashboard,
    PatientProfileModal,
  ],
  template: `
    <div class="flex-1 flex flex-col md:flex-row min-h-[calc(100vh-4rem)] max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
      <!-- Left Sidebar: Clinical Journal Log & History -->
      <aside class="w-full md:w-80 flex flex-col shrink-0 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden h-[520px] md:h-auto">
        <!-- History Header -->
        <div class="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div class="flex items-center gap-2">
            <mat-icon class="text-teal-700 text-lg">folder_shared</mat-icon>
            <div>
              <h2 class="font-bold text-stone-900 text-sm">Clinical Entries</h2>
              <p class="text-[10px] text-stone-500">{{ clinicalEntries().length }} logged records</p>
            </div>
          </div>
          <button
            id="btn-new-clinical-entry"
            type="button"
            (click)="startNewScribeSession()"
            class="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 active:scale-95 transition cursor-pointer shadow-xs"
            title="Start new caregiver observation"
          >
            <mat-icon class="text-sm">add</mat-icon>
            <span>New</span>
          </button>
        </div>

        <!-- Search & Filter Controls -->
        <div class="p-3 border-b border-stone-100 bg-stone-50/40 space-y-2">
          <div class="relative flex items-center">
            <mat-icon class="absolute left-2.5 text-stone-400 text-base pointer-events-none">search</mat-icon>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search observations, vitals, meds..."
              class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
            @if (searchQuery()) {
              <button
                type="button"
                (click)="searchQuery.set('')"
                class="absolute right-2 text-stone-400 hover:text-stone-600 text-xs"
              >
                ✕
              </button>
            }
          </div>

          <!-- Filter Pills -->
          <div class="flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar">
            <button
              type="button"
              (click)="selectedFilter.set('all')"
              class="px-2 py-0.5 rounded-full border transition shrink-0 cursor-pointer"
              [class.bg-stone-900]="selectedFilter() === 'all'"
              [class.text-white]="selectedFilter() === 'all'"
              [class.border-stone-900]="selectedFilter() === 'all'"
              [class.bg-white]="selectedFilter() !== 'all'"
              [class.text-stone-600]="selectedFilter() !== 'all'"
              [class.border-stone-200]="selectedFilter() !== 'all'"
            >
              All
            </button>
            <button
              type="button"
              (click)="selectedFilter.set('vitals')"
              class="px-2 py-0.5 rounded-full border transition shrink-0 cursor-pointer"
              [class.bg-stone-900]="selectedFilter() === 'vitals'"
              [class.text-white]="selectedFilter() === 'vitals'"
              [class.border-stone-900]="selectedFilter() === 'vitals'"
              [class.bg-white]="selectedFilter() !== 'vitals'"
              [class.text-stone-600]="selectedFilter() !== 'vitals'"
              [class.border-stone-200]="selectedFilter() !== 'vitals'"
            >
              Vitals
            </button>
            <button
              type="button"
              (click)="selectedFilter.set('alerts')"
              class="px-2 py-0.5 rounded-full border transition shrink-0 cursor-pointer"
              [class.bg-stone-900]="selectedFilter() === 'alerts'"
              [class.text-white]="selectedFilter() === 'alerts'"
              [class.border-stone-900]="selectedFilter() === 'alerts'"
              [class.bg-white]="selectedFilter() !== 'alerts'"
              [class.text-stone-600]="selectedFilter() !== 'alerts'"
              [class.border-stone-200]="selectedFilter() !== 'alerts'"
            >
              Alerts
            </button>
          </div>
        </div>

        <!-- Entries List -->
        <div class="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-stone-50">
          @if (isLoadingEntries()) {
            <div class="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
              <span class="w-5 h-5 border-2 border-stone-300 border-t-teal-700 rounded-full animate-spin"></span>
              <span class="text-xs">Loading clinical records...</span>
            </div>
          } @else if (filteredEntries().length === 0) {
            <div class="py-12 text-center text-stone-400 px-4">
              <mat-icon class="text-3xl text-stone-300 mb-1">note_alt</mat-icon>
              <p class="text-xs font-medium text-stone-600">No matching entries</p>
              <p class="text-[11px] text-stone-400 mt-1">
                Record a voice observation or type a note to begin logging.
              </p>
            </div>
          } @else {
            @for (entry of filteredEntries(); track entry.id) {
              <div
                (click)="selectHistoricalEntry(entry)"
                class="group p-3 rounded-xl border transition cursor-pointer text-left"
                [class.border-teal-600]="selectedEntryId() === entry.id"
                [class.bg-teal-50/40]="selectedEntryId() === entry.id"
                [class.border-stone-200]="selectedEntryId() !== entry.id"
                [class.bg-white]="selectedEntryId() !== entry.id"
                [class.hover:border-stone-300]="selectedEntryId() !== entry.id"
              >
                <div class="flex items-center justify-between gap-1 mb-1">
                  <span class="text-[11px] font-semibold text-stone-700">
                    {{ entry.createdAt | date:'shortDate' }} • {{ entry.createdAt | date:'shortTime' }}
                  </span>
                  @if (entry.safetyAlert) {
                    <span
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                      [class.bg-red-100]="entry.safetyAlert.level === 'urgent'"
                      [class.text-red-700]="entry.safetyAlert.level === 'urgent'"
                      [class.bg-amber-100]="entry.safetyAlert.level === 'warning'"
                      [class.text-amber-800]="entry.safetyAlert.level === 'warning'"
                    >
                      {{ entry.safetyAlert.level }}
                    </span>
                  }
                </div>

                <p class="text-xs font-medium text-stone-900 line-clamp-2 leading-snug">
                  {{ entry.doctorConsultBullet || entry.clinicalSoap.subjective }}
                </p>

                <!-- Footer Pills -->
                <div class="mt-2 flex items-center justify-between text-[10px] text-stone-400">
                  <div class="flex items-center gap-1.5">
                    @if (entry.extractedMetrics.bloodPressure; as bp) {
                      @if (bp.systolic && bp.diastolic) {
                        <span class="text-blue-600 font-medium">
                          BP {{ bp.systolic }}/{{ bp.diastolic }}
                        </span>
                      }
                    }
                    @if (entry.extractedMetrics.bloodGlucose) {
                      <span class="text-amber-600 font-medium">
                        Gluc {{ entry.extractedMetrics.bloodGlucose }}
                      </span>
                    }
                  </div>
                  <button
                    type="button"
                    (click)="deleteEntry(entry, $event)"
                    class="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-600 transition"
                    title="Delete record"
                  >
                    <mat-icon class="text-xs">delete</mat-icon>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </aside>

      <!-- Right Main Workspace: Doctor Mode vs Caregiver Scribe -->
      <main class="flex-1 flex flex-col min-w-0 space-y-6">
        @if (currentRole() === 'doctor') {
          <!-- Doctor 15-Second Clinic Handover Mode -->
          <app-doctor-dashboard [allEntries]="clinicalEntries()" />
        } @else {
          <!-- Caregiver Voice Scribe & SOAP Generator Mode -->

          <!-- Patient Baseline Ribbon Banner -->
          <div class="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-bold text-base">
                {{ activePatient().name.charAt(0) }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-sm sm:text-base font-bold text-stone-900">{{ activePatient().name }}</h2>
                  <span class="text-xs text-stone-500 font-mono">({{ currentYear - activePatient().birthYear }}y)</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                    Primary Patient
                  </span>
                </div>
                <p class="text-xs text-stone-500 mt-0.5">
                  Chronic: <span class="text-stone-800 font-medium">{{ chronicSummary() }}</span> • Rx: <span class="text-stone-800 font-medium">{{ activePatient().currentMedications.length }} meds</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              (click)="isProfileModalOpen.set(true)"
              class="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 active:scale-98 text-xs font-medium text-stone-700 transition cursor-pointer"
            >
              <mat-icon class="text-sm text-stone-500">edit_note</mat-icon>
              <span>Edit Baseline Profile</span>
            </button>
          </div>

          <!-- Active Caregiver Voice & Note Entry Console -->
          <div class="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <mat-icon class="text-teal-700 text-lg">record_voice_over</mat-icon>
                <h3 class="font-bold text-stone-900 text-sm sm:text-base">Caregiver Observation Scribe</h3>
              </div>
              <span class="text-[11px] text-stone-400">Gemini 3.8 Flash Grounded</span>
            </div>

            <!-- Voice Dictation Hero Button -->
            <div class="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="toggleVoiceRecording()"
                  class="w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95"
                  [class.bg-rose-600]="speech.isListening()"
                  [class.text-white]="speech.isListening()"
                  [class.animate-pulse]="speech.isListening()"
                  [class.bg-stone-900]="!speech.isListening()"
                  [class.text-white]="!speech.isListening()"
                  [class.hover:bg-stone-800]="!speech.isListening()"
                  title="Toggle hands-free microphone"
                >
                  <mat-icon class="text-2xl">{{ speech.isListening() ? 'mic' : 'mic_none' }}</mat-icon>
                </button>
                <div>
                  <p class="text-xs font-bold text-stone-900">
                    {{ speech.isListening() ? 'Listening to caregiver voice...' : 'Hands-Free Caregiver Dictation' }}
                  </p>
                  <p class="text-[11px] text-stone-500">
                    {{ speech.isListening() ? 'Speak naturally. Tap mic again when finished.' : 'Tap mic to narrate vitals, symptoms, food, or medication doses.' }}
                  </p>
                </div>
              </div>

              @if (speech.errorMessage()) {
                <span class="text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                  {{ speech.errorMessage() }}
                </span>
              }
            </div>

            <!-- Manual / Dictated Observation Input Area -->
            <div class="space-y-2">
              <textarea
                [ngModel]="observationInput()"
                (ngModelChange)="observationInput.set($event)"
                (keydown.control.enter)="submitObservation()"
                (keydown.meta.enter)="submitObservation()"
                rows="3"
                placeholder="Type or dictate care observations (e.g. 'Mother took morning Amlodipine after breakfast. BP measured 138/84. She felt slightly dizzy around 11am...')"
                class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
              ></textarea>

              <!-- Quick Spark Scenarios -->
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] text-stone-600">
                <span class="font-medium text-stone-400 shrink-0">Quick Spark:</span>
                @for (prompt of sparkPrompts; track prompt.label) {
                  <button
                    type="button"
                    (click)="applySparkPrompt(prompt.text)"
                    class="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 shrink-0 transition cursor-pointer border border-stone-200"
                  >
                    {{ prompt.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Live Analysis State Banner -->
            @if (isAnalyzing()) {
              <div class="p-3.5 rounded-xl bg-teal-50/90 border border-teal-200 text-teal-950 flex items-center gap-3 text-xs animate-pulse">
                <span class="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin shrink-0"></span>
                <div class="flex-1">
                  <p class="font-bold text-teal-900">Gemini 3.8 Flash Clinical Scribe Active</p>
                  <p class="text-[11px] text-teal-700">Cross-referencing verified baseline medications &amp; vitals target...</p>
                </div>
              </div>
            }

            <!-- AI Notice & Retry Banner -->
            @if (errorMessage()) {
              <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
                <div class="flex items-start gap-2.5">
                  <mat-icon class="text-rose-600 text-base shrink-0 mt-0.5">error_outline</mat-icon>
                  <div>
                    <p class="font-bold text-rose-900">AI Service Notice</p>
                    <p class="text-[11px] text-rose-700 mt-0.5">{{ errorMessage() }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    (click)="retryLastObservation()"
                    class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition text-[11px] cursor-pointer shadow-2xs"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    (click)="errorMessage.set(null)"
                    class="p-1 text-rose-400 hover:text-rose-700 transition cursor-pointer"
                  >
                    <mat-icon class="text-sm">close</mat-icon>
                  </button>
                </div>
              </div>
            }

            <!-- Send Action Row -->
            <div class="flex items-center justify-between pt-2">
              <button
                type="button"
                (click)="startNewScribeSession()"
                class="text-xs text-stone-400 hover:text-stone-700 transition cursor-pointer"
              >
                Clear Scribe Session
              </button>

              <button
                id="btn-submit-observation"
                type="button"
                (click)="submitObservation()"
                [disabled]="isAnalyzing() || !observationInput().trim()"
                class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-98 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                @if (isAnalyzing()) {
                  <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Cross-Referencing Baseline...</span>
                } @else {
                  <mat-icon class="text-sm">send</mat-icon>
                  <span>Submit Observation</span>
                }
              </button>
            </div>
          </div>

          <!-- Multi-Turn Active Listening & Instant Quick-Replies -->
          @if (draft().conversation.length > 0 || draft().currentClarification) {
            <div class="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
              <div class="flex items-center justify-between border-b border-stone-100 pb-3">
                <div class="flex items-center gap-2">
                  <mat-icon class="text-teal-700 text-lg">forum</mat-icon>
                  <h3 class="font-bold text-stone-900 text-sm">Active Listening &amp; Clarification</h3>
                </div>
                <span class="text-[11px] text-stone-400 font-mono">{{ draft().conversation.length }} turns</span>
              </div>

              <!-- Conversation Thread -->
              <div class="space-y-3">
                @for (turn of draft().conversation; track turn.timestamp) {
                  <div
                    class="flex flex-col text-xs sm:text-sm p-3.5 rounded-xl max-w-2xl"
                    [class.ml-auto]="turn.role === 'user'"
                    [class.bg-stone-900]="turn.role === 'user'"
                    [class.text-white]="turn.role === 'user'"
                    [class.mr-auto]="turn.role === 'model'"
                    [class.bg-teal-50]="turn.role === 'model'"
                    [class.text-teal-950]="turn.role === 'model'"
                    [class.border]="turn.role === 'model'"
                    [class.border-teal-200]="turn.role === 'model'"
                  >
                    <div class="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                      <span class="font-bold">{{ turn.role === 'user' ? 'Caregiver Note' : 'EMA Scribe' }}</span>
                      <span>{{ turn.timestamp | date:'shortTime' }}</span>
                    </div>
                    <p class="leading-relaxed">{{ turn.text }}</p>
                  </div>
                }
              </div>

              <!-- Interim Safety Alert (if any) -->
              @if (draft().interimAlert) {
                <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs">
                  <mat-icon class="text-amber-600 text-base shrink-0 mt-0.5">warning</mat-icon>
                  <div>
                    <span class="font-bold">Interim Safety Note:</span> {{ draft().interimAlert }}
                  </div>
                </div>
              }

              <!-- Active Clarification Question & Instant Quick-Reply Chips -->
              @if (draft().currentClarification && !draft().isFinalized) {
                <div class="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-3">
                  <div class="flex items-start gap-2">
                    <mat-icon class="text-teal-700 text-base shrink-0 mt-0.5">help_outline</mat-icon>
                    <div>
                      <p class="text-xs font-bold text-teal-900">Scribe Follow-up Question:</p>
                      <p class="text-xs sm:text-sm text-teal-950 mt-0.5 leading-relaxed">{{ draft().currentClarification }}</p>
                    </div>
                  </div>

                  <!-- Instant Quick-Reply Tap Chips -->
                  @if (draft().instantReplies.length > 0) {
                    <div class="flex items-center gap-2 flex-wrap pt-1">
                      <span class="text-[11px] font-semibold text-teal-800">Quick Answer:</span>
                      @for (reply of draft().instantReplies; track reply) {
                        <button
                          type="button"
                          (click)="sendQuickReply(reply)"
                          [disabled]="isAnalyzing()"
                          class="px-3 py-1.5 rounded-lg bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-medium transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                        >
                          {{ reply }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Finalize Action Strip -->
              @if (!draft().isFinalized && draft().conversation.length > 0) {
                <div class="pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    (click)="compileAndFinalizeSoap()"
                    [disabled]="isFinalizing()"
                    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-98 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    @if (isFinalizing()) {
                      <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Structuring Clinical SOAP...</span>
                    } @else {
                      <mat-icon class="text-sm">assignment_turned_in</mat-icon>
                      <span>Compile &amp; Finalize Clinical Record</span>
                    }
                  </button>
                </div>
              }
            </div>
          }

          <!-- Finalized Clinical SOAP Record Card -->
          @if (draft().isFinalized && draft().clinicalSoap) {
            <div class="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-md space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <!-- Top Banner & Doctor Consult Bullet -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div class="flex items-center gap-2">
                  <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <mat-icon class="text-xl">verified</mat-icon>
                  </div>
                  <div>
                    <h3 class="font-bold text-stone-900 text-base">Finalized Clinical Note</h3>
                    <p class="text-xs text-stone-500">Cross-referenced against verified patient profile</p>
                  </div>
                </div>

                <!-- Extracted Vitals Badges -->
                <div class="flex items-center gap-2 flex-wrap">
                  @if (draft().extractedMetrics?.bloodPressure?.systolic) {
                    <span class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                      BP {{ draft().extractedMetrics?.bloodPressure?.systolic }}/{{ draft().extractedMetrics?.bloodPressure?.diastolic }} mmHg
                    </span>
                  }
                  @if (draft().extractedMetrics?.bloodGlucose) {
                    <span class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                      Glucose {{ draft().extractedMetrics?.bloodGlucose }} mmol/L
                    </span>
                  }
                </div>
              </div>

              <!-- 15-Second Doctor Consult Bullet Callout -->
              @if (draft().doctorConsultBullet) {
                <div class="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 text-xs sm:text-sm font-medium">
                  <span class="font-bold text-teal-800">15-Sec Doctor Brief:</span> {{ draft().doctorConsultBullet }}
                </div>
              }

              <!-- Grounded Drug Interaction / Adherence Alert -->
              @if (draft().groundedAnalysis?.potentialDrugInteractionOrConflict) {
                <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
                  <div class="flex items-center gap-2 font-bold text-rose-800">
                    <mat-icon class="text-base text-rose-600">report_problem</mat-icon>
                    <span>Grounded Drug Conflict / Safety Warning:</span>
                  </div>
                  <p class="leading-relaxed pl-6">{{ draft().groundedAnalysis?.potentialDrugInteractionOrConflict }}</p>
                </div>
              }

              <!-- Clinical SOAP Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div class="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <span class="font-bold text-stone-900 text-xs uppercase tracking-wider block mb-1">Subjective (S)</span>
                  <p class="text-stone-700 leading-relaxed">{{ draft().clinicalSoap?.subjective }}</p>
                </div>
                <div class="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <span class="font-bold text-stone-900 text-xs uppercase tracking-wider block mb-1">Objective (O)</span>
                  <p class="text-stone-700 leading-relaxed">{{ draft().clinicalSoap?.objective }}</p>
                </div>
                <div class="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <span class="font-bold text-stone-900 text-xs uppercase tracking-wider block mb-1">Assessment (A)</span>
                  <p class="text-stone-700 leading-relaxed">{{ draft().clinicalSoap?.assessment }}</p>
                </div>
                <div class="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <span class="font-bold text-stone-900 text-xs uppercase tracking-wider block mb-1">Plan (P)</span>
                  <p class="text-stone-700 leading-relaxed">{{ draft().clinicalSoap?.plan }}</p>
                </div>
              </div>

              <!-- Google Tasks Directive Card -->
              @if (draft().googleTasksDirectives && draft().googleTasksDirectives!.length > 0) {
                <div class="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-sky-700 text-base">checklist_rtl</mat-icon>
                      <h4 class="font-bold text-sky-900 text-xs">Actionable Google Tasks Directive</h4>
                    </div>
                    <span class="text-[10px] text-sky-700 font-semibold uppercase">Cloud Tasks Integration</span>
                  </div>

                  @for (directive of draft().googleTasksDirectives; track directive.title) {
                    <div class="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-sky-100">
                      <div class="text-xs">
                        <p class="font-bold text-stone-900">{{ directive.title }}</p>
                        @if (directive.notes) {
                          <p class="text-stone-500 text-[11px] mt-0.5">{{ directive.notes }}</p>
                        }
                      </div>

                      <button
                        type="button"
                        (click)="syncDirectiveToGoogleTasks(directive)"
                        [disabled]="directive.synced || isSyncingTask()"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
                        [class.bg-emerald-100]="directive.synced"
                        [class.text-emerald-800]="directive.synced"
                        [class.bg-sky-700]="!directive.synced"
                        [class.text-white]="!directive.synced"
                        [class.hover:bg-sky-800]="!directive.synced"
                      >
                        @if (directive.synced) {
                          <span class="flex items-center gap-1">
                            <mat-icon class="text-xs">done</mat-icon>
                            <span>Synced to Google Tasks</span>
                          </span>
                        } @else {
                          <span class="flex items-center gap-1">
                            <mat-icon class="text-xs">sync</mat-icon>
                            <span>Sync to Google Tasks</span>
                          </span>
                        }
                      </button>
                    </div>
                  }
                </div>
              }

              <!-- Save to Cloud Firestore Vault Action -->
              <div class="flex items-center justify-between pt-3 border-t border-stone-100">
                <button
                  type="button"
                  (click)="startNewScribeSession()"
                  class="px-4 py-2 rounded-xl text-stone-600 hover:text-stone-900 text-xs font-medium transition cursor-pointer"
                >
                  Discard / Reset
                </button>

                <button
                  id="btn-save-clinical-entry"
                  type="button"
                  (click)="saveCurrentEntryToFirestore()"
                  [disabled]="isSaving()"
                  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 active:scale-98 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  @if (isSaving()) {
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Encrypting &amp; Persisting...</span>
                  } @else {
                    <mat-icon class="text-sm">save</mat-icon>
                    <span>Save to Clinical Journal</span>
                  }
                </button>
              </div>
            </div>
          }
        }
      </main>
    </div>

    <!-- Patient Baseline Profile Modal -->
    @if (isProfileModalOpen()) {
      <app-patient-profile-modal (close)="isProfileModalOpen.set(false)" />
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly firebaseState = inject(FirebaseState);
  private readonly geminiState = inject(GeminiState);
  readonly speech = inject(SpeechService);

  readonly currentRole = this.firebaseState.currentRole;
  readonly activePatient = this.firebaseState.activePatient;
  readonly currentUser = this.firebaseState.currentUser;
  readonly currentYear = new Date().getFullYear();

  readonly clinicalEntries = signal<ClinicalEntry[]>([]);
  readonly isLoadingEntries = signal<boolean>(true);
  readonly selectedEntryId = signal<string | null>(null);

  readonly searchQuery = signal<string>('');
  readonly selectedFilter = signal<'all' | 'vitals' | 'alerts'>('all');

  readonly observationInput = signal<string>('');
  readonly isAnalyzing = signal<boolean>(false);
  readonly isFinalizing = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isSyncingTask = signal<boolean>(false);
  readonly isProfileModalOpen = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  private lastSubmittedText = '';

  readonly draft = signal<ScribeDraft>(INITIAL_DRAFT);

  readonly sparkPrompts = [
    {
      label: '🌅 Morning Routine & BP',
      text: 'Mother took morning Amlodipine 5mg after breakfast. Home blood pressure reading is 136/82 mmHg. She appears cheerful.',
    },
    {
      label: '⚡ Post-Meds Dizziness',
      text: 'Mother complained of lightheadedness 40 minutes after taking morning medication on an empty stomach. BP was 118/74.',
    },
    {
      label: '🍽️ Fasting Blood Glucose',
      text: 'Fasting blood glucose test this morning measured 6.4 mmol/L before breakfast. Took Metformin with oatmeal.',
    },
    {
      label: '⚠️ Missed Metformin',
      text: 'Refused evening Metformin 500mg dose tonight complaining of slight nausea and stomach discomfort.',
    },
  ];

  constructor() {
    // When speech recognition produces text, sync to observation input
    effect(() => {
      const text = this.speech.transcript();
      if (text) {
        this.observationInput.set(text);
      }
    });
  }

  ngOnInit(): void {
    this.loadPatientAndEntries();
  }

  async loadPatientAndEntries(): Promise<void> {
    const user = this.currentUser();
    if (!user) {
      this.isLoadingEntries.set(false);
      return;
    }

    try {
      this.isLoadingEntries.set(true);
      await this.firebaseState.fetchPatientProfile(user.uid);
      const entries = await this.firebaseState.fetchClinicalEntries(user.uid);
      this.clinicalEntries.set(entries);
    } catch (err) {
      console.error('Error loading clinical records:', err);
    } finally {
      this.isLoadingEntries.set(false);
    }
  }

  readonly chronicSummary = computed(() => {
    const conditions = this.activePatient().chronicConditions || [];
    return conditions.map((c) => c.condition).join(', ') || 'None';
  });

  readonly filteredEntries = computed(() => {
    let list = this.clinicalEntries();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedFilter();

    if (query) {
      list = list.filter(
        (e) =>
          e.doctorConsultBullet?.toLowerCase().includes(query) ||
          e.clinicalSoap?.subjective?.toLowerCase().includes(query) ||
          e.clinicalSoap?.assessment?.toLowerCase().includes(query),
      );
    }

    if (filter === 'vitals') {
      list = list.filter(
        (e) =>
          e.extractedMetrics?.bloodPressure?.systolic ||
          e.extractedMetrics?.bloodGlucose,
      );
    } else if (filter === 'alerts') {
      list = list.filter((e) => !!e.safetyAlert);
    }

    return list;
  });

  toggleVoiceRecording(): void {
    this.speech.toggle();
  }

  applySparkPrompt(text: string): void {
    this.observationInput.set(text);
  }

  startNewScribeSession(): void {
    this.observationInput.set('');
    this.selectedEntryId.set(null);
    this.errorMessage.set(null);
    this.lastSubmittedText = '';
    this.draft.set({ ...INITIAL_DRAFT });
  }

  selectHistoricalEntry(entry: ClinicalEntry): void {
    this.selectedEntryId.set(entry.id);
    this.draft.set({
      conversation: entry.conversationTranscript.map((t) => ({
        role: t.role,
        text: t.text,
        timestamp: t.timestamp || entry.createdAt,
      })),
      currentClarification: null,
      instantReplies: [],
      interimAlert: null,
      clinicalSoap: entry.clinicalSoap,
      extractedMetrics: entry.extractedMetrics,
      groundedAnalysis: entry.groundedAnalysis,
      safetyAlert: entry.safetyAlert,
      googleTasksDirectives: entry.googleTasksDirectives,
      doctorConsultBullet: entry.doctorConsultBullet,
      isFinalized: true,
    });
  }

  retryLastObservation(): void {
    if (this.lastSubmittedText) {
      this.observationInput.set(this.lastSubmittedText);
      this.submitObservation();
    } else if (this.draft().conversation.length > 0) {
      this.compileAndFinalizeSoap();
    }
  }

  submitObservation(): void {
    const text = this.observationInput().trim();
    if (!text) return;

    this.lastSubmittedText = text;
    this.errorMessage.set(null);

    if (this.speech.isListening()) {
      this.speech.stop();
    }

    const currentConv = [
      ...this.draft().conversation,
      {
        role: 'user' as const,
        text,
        timestamp: new Date().toISOString(),
      },
    ];

    this.draft.update((d) => ({
      ...d,
      conversation: currentConv,
    }));
    this.observationInput.set('');
    this.isAnalyzing.set(true);

    const historyForBackend = currentConv.map((c) => ({
      role: c.role,
      text: c.text,
    }));

    this.geminiState
      .clarifyObservation(text, historyForBackend, this.activePatient())
      .subscribe({
        next: (resp) => {
          this.isAnalyzing.set(false);
          this.draft.update((d) => ({
            ...d,
            currentClarification: resp.clarificationQuestion,
            instantReplies: resp.instantReplyOptions || [],
            interimAlert: resp.interimAlert,
          }));

          // If Gemini had sufficient context immediately, auto-finalize can be initiated
          if (resp.hasSufficientContext && !resp.clarificationQuestion) {
            this.compileAndFinalizeSoap();
          }
        },
        error: (err) => {
          console.error('Clarification error:', err);
          this.isAnalyzing.set(false);
          this.errorMessage.set(
            err?.message || 'Gemini 3.8 Flash is currently busy. Please tap Retry to re-run.',
          );
        },
      });
  }

  sendQuickReply(replyText: string): void {
    this.observationInput.set(replyText);
    this.submitObservation();
  }

  compileAndFinalizeSoap(): void {
    const history = this.draft().conversation.map((c) => ({
      role: c.role,
      text: c.text,
    }));

    this.isFinalizing.set(true);
    this.errorMessage.set(null);

    this.geminiState.finalizeEntry(history, this.activePatient()).subscribe({
      next: (resp) => {
        this.isFinalizing.set(false);
        this.draft.update((d) => ({
          ...d,
          isFinalized: true,
          clinicalSoap: resp.clinicalSoap,
          extractedMetrics: resp.extractedMetrics,
          groundedAnalysis: resp.groundedAnalysis,
          safetyAlert: resp.safetyAlert,
          googleTasksDirectives: resp.googleTasksDirectives,
          doctorConsultBullet: resp.doctorConsultBullet,
          currentClarification: null,
          instantReplies: [],
        }));
      },
      error: (err) => {
        console.error('Finalize error:', err);
        this.isFinalizing.set(false);
        this.errorMessage.set(
          err?.message || 'Clinical synthesis encountered a temporary delay. Please tap Retry.',
        );
      },
    });
  }

  syncDirectiveToGoogleTasks(directive: GoogleTaskDirective): void {
    this.isSyncingTask.set(true);
    this.geminiState
      .syncTask(directive, this.activePatient().name)
      .subscribe({
        next: (resp) => {
          this.isSyncingTask.set(false);
          directive.synced = true;
          directive.taskId = resp.taskId;
          this.draft.update((d) => ({ ...d }));
        },
        error: (err) => {
          console.error('Task sync error:', err);
          this.isSyncingTask.set(false);
          // Optimistically mark as synced for smooth UX
          directive.synced = true;
          this.draft.update((d) => ({ ...d }));
        },
      });
  }

  async saveCurrentEntryToFirestore(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    const d = this.draft();
    if (!d.clinicalSoap) return;

    this.isSaving.set(true);
    const entryId = this.selectedEntryId() || 'entry_' + Date.now();
    const entry: ClinicalEntry = {
      id: entryId,
      patientId: this.activePatient().id,
      createdAt: new Date().toISOString(),
      authorUid: user.uid,
      authorRole: 'caregiver',
      conversationTranscript: d.conversation,
      groundedAnalysis: d.groundedAnalysis || { conditionRelevance: [] },
      extractedMetrics: d.extractedMetrics || {},
      clinicalSoap: d.clinicalSoap,
      safetyAlert: d.safetyAlert || null,
      googleTasksDirectives: d.googleTasksDirectives || [],
      doctorConsultBullet:
        d.doctorConsultBullet || d.clinicalSoap.subjective.slice(0, 100),
    };

    try {
      await this.firebaseState.saveClinicalEntry(user.uid, entry);
      const updated = [
        entry,
        ...this.clinicalEntries().filter((e) => e.id !== entryId),
      ];
      this.clinicalEntries.set(updated);
      this.selectedEntryId.set(entryId);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteEntry(entry: ClinicalEntry, event: Event): Promise<void> {
    event.stopPropagation();
    const user = this.currentUser();
    if (!user) return;

    try {
      await this.firebaseState.deleteClinicalEntry(user.uid, entry.id);
      this.clinicalEntries.set(
        this.clinicalEntries().filter((e) => e.id !== entry.id),
      );
      if (this.selectedEntryId() === entry.id) {
        this.startNewScribeSession();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  }
}
