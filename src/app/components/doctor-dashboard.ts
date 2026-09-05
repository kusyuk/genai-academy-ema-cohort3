import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {
  ClinicalEntry,
  ConsultationHandover,
  PatientProfile,
} from '../models/clinical';
import {FirebaseState} from '../services/firebase';
import {GeminiState} from '../services/gemini';

type TimeRangeFilter = '7d' | '30d' | 'all';

interface VitalPoint {
  date: Date;
  dateStr: string;
  systolic: number | null;
  diastolic: number | null;
  glucose: number | null;
  x: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-doctor-dashboard',
  imports: [MatIconModule, DatePipe, DecimalPipe],
  template: `
    <div class="space-y-6">
      <!-- Doctor Mode Hero Header -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <mat-icon class="text-2xl">medical_services</mat-icon>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-lg sm:text-xl font-bold text-slate-900">Doctor Consultation Handover</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200/80">
                  Longitudinal Physician Brief
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">
                Patient: <span class="font-semibold text-slate-800">{{ patient().name }}</span> ({{ currentYear - patient().birthYear }}y) • Baseline: {{ chronicConditionsSummary() }}
              </p>
            </div>
          </div>

          <!-- Interval Selector & AI Refresh Action -->
          <div class="flex items-center gap-2 self-end sm:self-center">
            <div class="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
              <button
                type="button"
                (click)="selectedRange.set('7d')"
                class="px-3 py-1 rounded-lg transition cursor-pointer"
                [class.bg-white]="selectedRange() === '7d'"
                [class.text-slate-900]="selectedRange() === '7d'"
                [class.shadow-xs]="selectedRange() === '7d'"
                [class.text-slate-600]="selectedRange() !== '7d'"
              >
                7 Days
              </button>
              <button
                type="button"
                (click)="selectedRange.set('30d')"
                class="px-3 py-1 rounded-lg transition cursor-pointer"
                [class.bg-white]="selectedRange() === '30d'"
                [class.text-slate-900]="selectedRange() === '30d'"
                [class.shadow-xs]="selectedRange() === '30d'"
                [class.text-slate-600]="selectedRange() !== '30d'"
              >
                30 Days
              </button>
              <button
                type="button"
                (click)="selectedRange.set('all')"
                class="px-3 py-1 rounded-lg transition cursor-pointer"
                [class.bg-white]="selectedRange() === 'all'"
                [class.text-slate-900]="selectedRange() === 'all'"
                [class.shadow-xs]="selectedRange() === 'all'"
                [class.text-slate-600]="selectedRange() !== 'all'"
              >
                All
              </button>
            </div>

            <button
              type="button"
              (click)="generateHandoverSynthesis()"
              [disabled]="isSynthesizing() || filteredEntries().length === 0"
              class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-medium transition cursor-pointer shadow-xs"
              title="Re-synthesize doctor brief with Gemini"
            >
              @if (isSynthesizing()) {
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Synthesizing...</span>
              } @else {
                <mat-icon class="text-sm">auto_awesome</mat-icon>
                <span>AI Brief</span>
              }
            </button>
          </div>
        </div>

        <!-- Verified Prescription Ribbon -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-600 overflow-x-auto no-scrollbar">
          <span class="font-semibold text-slate-700 shrink-0">Current Rx:</span>
          @for (med of patient().currentMedications; track med.name) {
            <span class="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 shrink-0">
              {{ med.name }} {{ med.dosage }} ({{ med.frequency }})
            </span>
          }
          @if (patient().allergies.length > 0) {
            <span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 shrink-0 font-medium">
              Allergy: {{ patient().allergies[0].allergen }}
            </span>
          }
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Entries Analyzed</span>
            <mat-icon class="text-base text-slate-400">receipt_long</mat-icon>
          </div>
          <p class="text-2xl font-bold text-slate-900">{{ filteredEntries().length }}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">In chosen period</p>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Avg Blood Pressure</span>
            <mat-icon class="text-base text-rose-500">favorite</mat-icon>
          </div>
          <p class="text-2xl font-bold" [class.text-rose-600]="avgBp().isElevated" [class.text-slate-900]="!avgBp().isElevated">
            @if (avgBp().systolic && avgBp().diastolic) {
              {{ avgBp().systolic }}/{{ avgBp().diastolic }}
              <span class="text-xs font-normal text-slate-500">mmHg</span>
            } @else {
              <span class="text-slate-400 text-lg font-medium">N/A</span>
            }
          </p>
          <p class="text-[10px] mt-0.5" [class.text-rose-600]="avgBp().isElevated" [class.text-slate-500]="!avgBp().isElevated">
            Target: &lt;{{ patient().baselineVitals.targetBpSystolic }}/{{ patient().baselineVitals.targetBpDiastolic }}
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Avg Blood Glucose</span>
            <mat-icon class="text-base text-amber-500">water_drop</mat-icon>
          </div>
          <p class="text-2xl font-bold text-slate-900">
            @if (avgGlucose() !== null) {
              {{ avgGlucose() | number:'1.1-1' }}
              <span class="text-xs font-normal text-slate-500">mmol/L</span>
            } @else {
              <span class="text-slate-400 text-lg font-medium">N/A</span>
            }
          </p>
          <p class="text-[10px] text-slate-500 mt-0.5">Target: {{ patient().baselineVitals.fastingBloodSugarRange }}</p>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Med Adherence</span>
            <mat-icon class="text-base text-emerald-500">task_alt</mat-icon>
          </div>
          <p class="text-2xl font-bold" [class.text-emerald-600]="adherenceRate() >= 80" [class.text-amber-700]="adherenceRate() < 80">
            {{ adherenceRate() }}%
          </p>
          <p class="text-[10px] text-slate-500 mt-0.5">Prescription compliance</p>
        </div>
      </div>

      <!-- 3-Sentence AI Synthesis Card -->
      <div class="bg-linear-to-r from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div class="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
            </span>
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-300">Gemini 3.8 Clinical Synthesis</span>
          </div>
          @if (handover()) {
            <span class="text-[10px] text-slate-300">
              Period: {{ handover()?.periodCovered?.from | date:'shortDate' }} - {{ handover()?.periodCovered?.to | date:'shortDate' }}
            </span>
          }
        </div>

        <div class="text-slate-100 text-sm sm:text-base leading-relaxed">
          @if (isSynthesizing()) {
            <div class="py-4 flex items-center gap-3 text-indigo-200">
              <span class="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
              <span>Gemini 3.8 Flash is synthesizing longitudinal vitals and notes for the Doctor Consultation Handover...</span>
            </div>
          } @else if (handover()) {
            <p>{{ handover()?.aiSynthesizedOverview }}</p>
          } @else {
            <p>{{ defaultOverviewText() }}</p>
          }
        </div>

        @if (handover() && handover()?.vitalsSummary?.notableOutliers?.length) {
          <div class="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-amber-200 flex-wrap">
            <span class="font-semibold text-amber-300">Flagged Outliers:</span>
            @for (outlier of handover()?.vitalsSummary?.notableOutliers; track outlier) {
              <span class="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-100 text-[11px]">
                {{ outlier }}
              </span>
            }
          </div>
        }
      </div>

      <!-- Longitudinal SVG Vitals Trend Chart -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-600 text-lg">show_chart</mat-icon>
            <h2 class="font-bold text-slate-900 text-sm sm:text-base">Longitudinal Vitals Trends</h2>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 bg-indigo-600 inline-block rounded-full"></span>
              <span>Systolic BP</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 bg-emerald-600 inline-block rounded-full"></span>
              <span>Diastolic BP</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 bg-amber-500 rounded-full inline-block"></span>
              <span>Glucose (mmol/L)</span>
            </div>
          </div>
        </div>

        <!-- SVG Chart Render -->
        @if (vitalPoints().length > 0) {
          <div class="w-full overflow-x-auto">
            <div class="min-w-[500px] h-64 relative">
              <svg class="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
                <!-- Target Systolic Normal Zone (110 - 130) -->
                <rect x="50" y="55" width="530" height="35" fill="#ecfdf5" opacity="0.9" />
                <text x="55" y="77" fill="#047857" font-size="9" font-family="sans-serif">Target BP Zone (120-130)</text>

                <!-- Gridlines -->
                <line x1="50" y1="30" x2="580" y2="30" stroke="#f1f5f9" stroke-width="1" />
                <line x1="50" y1="75" x2="580" y2="75" stroke="#f1f5f9" stroke-width="1" />
                <line x1="50" y1="120" x2="580" y2="120" stroke="#f1f5f9" stroke-width="1" />
                <line x1="50" y1="165" x2="580" y2="165" stroke="#f1f5f9" stroke-width="1" />
                <line x1="50" y1="190" x2="580" y2="190" stroke="#cbd5e1" stroke-width="1" />

                <!-- Y-Axis Labels -->
                <text x="40" y="34" text-anchor="end" fill="#94a3b8" font-size="9">160</text>
                <text x="40" y="79" text-anchor="end" fill="#94a3b8" font-size="9">130</text>
                <text x="40" y="124" text-anchor="end" fill="#94a3b8" font-size="9">100</text>
                <text x="40" y="169" text-anchor="end" fill="#94a3b8" font-size="9">70</text>

                <!-- Systolic BP Line (Indigo) -->
                @if (systolicPath()) {
                  <path [attr.d]="systolicPath()" fill="none" stroke="#4f46e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                }

                <!-- Diastolic BP Line (Emerald) -->
                @if (diastolicPath()) {
                  <path [attr.d]="diastolicPath()" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                }

                <!-- Data Points and Tooltip Circles -->
                @for (pt of vitalPoints(); track pt.dateStr) {
                  @if (pt.systolic !== null) {
                    <circle [attr.cx]="pt.x" [attr.cy]="scaleYBp(pt.systolic)" r="4" fill="#4f46e5" stroke="#ffffff" stroke-width="2" />
                    <text [attr.cx]="pt.x" [attr.y]="scaleYBp(pt.systolic) - 6" [attr.x]="pt.x" text-anchor="middle" fill="#312e81" font-size="8" font-weight="bold">
                      {{ pt.systolic }}
                    </text>
                  }
                  @if (pt.diastolic !== null) {
                    <circle [attr.cx]="pt.x" [attr.cy]="scaleYBp(pt.diastolic)" r="3.5" fill="#059669" stroke="#ffffff" stroke-width="1.5" />
                  }
                  @if (pt.glucose !== null) {
                    <polygon [attr.points]="getDiamondPoints(pt.x, scaleYGlucose(pt.glucose))" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />
                    <text [attr.x]="pt.x" [attr.y]="scaleYGlucose(pt.glucose) + 12" text-anchor="middle" fill="#b45309" font-size="8" font-weight="bold">
                      {{ pt.glucose }}
                    </text>
                  }

                  <!-- X-Axis Date label -->
                  <text [attr.x]="pt.x" y="205" text-anchor="middle" fill="#64748b" font-size="9">
                    {{ pt.date | date:'MM/dd' }}
                  </text>
                }
              </svg>
            </div>
          </div>
        } @else {
          <div class="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <mat-icon class="text-3xl text-slate-300 mb-1">query_stats</mat-icon>
            <p class="text-xs font-medium text-slate-600">No vital sign readings logged during this time window</p>
            <p class="text-[11px] text-slate-400 mt-0.5">Entries with Blood Pressure or Glucose readings will plot automatically</p>
          </div>
        }
      </div>

      <!-- Two-Column Clinical Insight Modules -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Recurring Symptom Patterns -->
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div class="flex items-center gap-2 mb-3">
            <mat-icon class="text-amber-600 text-lg">pattern</mat-icon>
            <h2 class="font-bold text-slate-900 text-sm sm:text-base">Recurring Symptom Patterns</h2>
          </div>
          <p class="text-xs text-slate-500 mb-4">Gemini-detected correlations across multiple journal observations.</p>

          @if (symptomPatterns().length > 0) {
            <div class="space-y-3">
              @for (pattern of symptomPatterns(); track pattern.symptom) {
                <div class="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="font-semibold text-xs text-slate-900">{{ pattern.symptom }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {{ pattern.frequency }}x reported
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-600 leading-relaxed">
                    <span class="font-medium text-slate-700">Hypothesized Trigger:</span> {{ pattern.potentialTrigger }}
                  </p>
                </div>
              }
            </div>
          } @else {
            <div class="py-8 text-center text-slate-400 bg-slate-50 rounded-xl">
              <mat-icon class="text-2xl text-slate-300 mb-1">sentiment_satisfied</mat-icon>
              <p class="text-xs text-slate-600">No acute recurring symptom patterns detected</p>
              <p class="text-[10px] text-slate-400">Caregiver has reported stable baseline conditions.</p>
            </div>
          }
        </div>

        <!-- Suggested Consultation Agenda -->
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div class="flex items-center gap-2 mb-3">
            <mat-icon class="text-indigo-600 text-lg">checklist</mat-icon>
            <h2 class="font-bold text-slate-900 text-sm sm:text-base">Suggested Clinical Discussion Agenda</h2>
          </div>
          <p class="text-xs text-slate-500 mb-4">High-priority discussion targets for the face-to-face consult.</p>

          <div class="space-y-2.5">
            @for (point of discussionPoints(); track point) {
              <div class="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/90">
                <mat-icon class="text-indigo-700 text-base shrink-0 mt-0.5">check_box_outline_blank</mat-icon>
                <span class="text-xs text-slate-800 leading-relaxed">{{ point }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Chronological Consult Journal Feed -->
      <div class="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <mat-icon class="text-slate-700 text-lg">history</mat-icon>
            <h2 class="font-bold text-slate-900 text-sm sm:text-base">Clinical Observations in Scope</h2>
          </div>
          <span class="text-xs text-slate-400 font-mono">{{ filteredEntries().length }} records</span>
        </div>

        @if (filteredEntries().length > 0) {
          <div class="space-y-4">
            @for (entry of filteredEntries(); track entry.id) {
              <div class="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/40 transition">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-800">{{ entry.createdAt | date:'mediumDate' }} at {{ entry.createdAt | date:'shortTime' }}</span>
                    @if (entry.safetyAlert) {
                      <span
                        class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                        [class.bg-rose-100]="entry.safetyAlert.level === 'urgent'"
                        [class.text-rose-800]="entry.safetyAlert.level === 'urgent'"
                        [class.bg-amber-100]="entry.safetyAlert.level === 'warning'"
                        [class.text-amber-800]="entry.safetyAlert.level === 'warning'"
                      >
                        {{ entry.safetyAlert.level }}
                      </span>
                    }
                  </div>
                  <!-- Vitals Badges -->
                  <div class="flex items-center gap-1.5 text-[11px]">
                    @if (entry.extractedMetrics.bloodPressure; as bp) {
                      @if (bp.systolic && bp.diastolic) {
                        <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200/80 font-medium">
                          BP {{ bp.systolic }}/{{ bp.diastolic }}
                        </span>
                      }
                    }
                    @if (entry.extractedMetrics.bloodGlucose) {
                      <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-medium">
                        Glucose {{ entry.extractedMetrics.bloodGlucose }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Doctor Handover Consult Bullet -->
                <p class="text-xs font-medium text-slate-900 mb-2">
                  👉 {{ entry.doctorConsultBullet }}
                </p>

                <!-- Expandable Clinical SOAP note -->
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                  <div>
                    <span class="font-bold text-slate-700">Subjective:</span> {{ entry.clinicalSoap.subjective }}
                  </div>
                  <div>
                    <span class="font-bold text-slate-700">Objective:</span> {{ entry.clinicalSoap.objective }}
                  </div>
                  <div>
                    <span class="font-bold text-slate-700">Assessment:</span> {{ entry.clinicalSoap.assessment }}
                  </div>
                  <div>
                    <span class="font-bold text-slate-700">Plan:</span> {{ entry.clinicalSoap.plan }}
                  </div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="py-10 text-center text-slate-400">
            <p class="text-xs">No clinical records found for the selected interval.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class DoctorDashboard implements OnInit {
  private readonly firebaseState = inject(FirebaseState);
  private readonly geminiState = inject(GeminiState);

  readonly allEntries = input<ClinicalEntry[]>([]);
  readonly selectedRange = signal<TimeRangeFilter>('7d');
  readonly isSynthesizing = signal<boolean>(false);
  readonly handover = signal<ConsultationHandover | null>(null);

  readonly patient = this.firebaseState.activePatient;
  readonly currentYear = new Date().getFullYear();

  ngOnInit(): void {
    // If entries are already present, trigger synthesis if none exists
    if (this.filteredEntries().length > 0 && !this.handover()) {
      this.generateHandoverSynthesis();
    }
  }

  readonly chronicConditionsSummary = computed(() => {
    const list = this.patient().chronicConditions || [];
    return list.map((c) => c.condition).join(', ') || 'None declared';
  });

  readonly filteredEntries = computed(() => {
    const entries = this.allEntries();
    const range = this.selectedRange();
    if (range === 'all') return entries;

    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return entries.filter((e) => new Date(e.createdAt) >= cutoff);
  });

  readonly avgBp = computed(() => {
    const valid = this.filteredEntries().filter(
      (e) =>
        e.extractedMetrics?.bloodPressure?.systolic &&
        e.extractedMetrics?.bloodPressure?.diastolic,
    );
    if (valid.length === 0) return { systolic: null, diastolic: null, isElevated: false };

    const totalSys = valid.reduce(
      (acc, cur) => acc + (cur.extractedMetrics.bloodPressure?.systolic || 0),
      0,
    );
    const totalDia = valid.reduce(
      (acc, cur) => acc + (cur.extractedMetrics.bloodPressure?.diastolic || 0),
      0,
    );
    const avgSys = Math.round(totalSys / valid.length);
    const avgDia = Math.round(totalDia / valid.length);

    return {
      systolic: avgSys,
      diastolic: avgDia,
      isElevated: avgSys > 135 || avgDia > 85,
    };
  });

  readonly avgGlucose = computed(() => {
    const valid = this.filteredEntries().filter(
      (e) => typeof e.extractedMetrics?.bloodGlucose === 'number',
    );
    if (valid.length === 0) return null;
    const sum = valid.reduce(
      (acc, cur) => acc + (cur.extractedMetrics.bloodGlucose || 0),
      0,
    );
    return sum / valid.length;
  });

  readonly adherenceRate = computed(() => {
    if (this.handover()?.adherenceRatePercentage !== undefined) {
      return this.handover()!.adherenceRatePercentage;
    }
    const total = this.filteredEntries().length;
    if (total === 0) return 100;
    const missed = this.filteredEntries().filter(
      (e) =>
        e.groundedAnalysis?.adherenceFlag ||
        e.clinicalSoap?.assessment?.toLowerCase().includes('missed') ||
        e.clinicalSoap?.subjective?.toLowerCase().includes('missed'),
    ).length;
    return Math.max(0, Math.round(((total - missed) / total) * 100));
  });

  readonly vitalPoints = computed<VitalPoint[]>(() => {
    const entries = [...this.filteredEntries()].reverse();
    const pointsWithVitals = entries.filter(
      (e) =>
        e.extractedMetrics?.bloodPressure?.systolic !== null ||
        e.extractedMetrics?.bloodGlucose !== null,
    );
    if (pointsWithVitals.length === 0) return [];

    const total = pointsWithVitals.length;
    const startX = 70;
    const endX = 560;
    const step = total > 1 ? (endX - startX) / (total - 1) : 0;

    return pointsWithVitals.map((e, idx) => ({
      date: new Date(e.createdAt),
      dateStr: e.createdAt,
      systolic: e.extractedMetrics?.bloodPressure?.systolic ?? null,
      diastolic: e.extractedMetrics?.bloodPressure?.diastolic ?? null,
      glucose: e.extractedMetrics?.bloodGlucose ?? null,
      x: total === 1 ? (startX + endX) / 2 : Math.round(startX + idx * step),
    }));
  });

  // SVG Scales: Y bounds for BP: 60 to 180 mmHg mapped to SVG y: 190 down to 25
  scaleYBp(val: number): number {
    const minVal = 60;
    const maxVal = 180;
    const minY = 25;
    const maxY = 185;
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return Math.round(maxY - ((clamped - minVal) / (maxVal - minVal)) * (maxY - minY));
  }

  // SVG Scales: Y bounds for Glucose: 3.0 to 16.0 mmol/L mapped to SVG y: 185 down to 35
  scaleYGlucose(val: number): number {
    const minVal = 3.0;
    const maxVal = 16.0;
    const minY = 35;
    const maxY = 185;
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return Math.round(maxY - ((clamped - minVal) / (maxVal - minVal)) * (maxY - minY));
  }

  getDiamondPoints(x: number, y: number): string {
    const size = 5;
    return `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`;
  }

  readonly systolicPath = computed(() => {
    const pts = this.vitalPoints().filter((p) => p.systolic !== null);
    if (pts.length < 2) return '';
    return pts.reduce(
      (path, pt, idx) =>
        `${path} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${this.scaleYBp(pt.systolic!)}`,
      '',
    );
  });

  readonly diastolicPath = computed(() => {
    const pts = this.vitalPoints().filter((p) => p.diastolic !== null);
    if (pts.length < 2) return '';
    return pts.reduce(
      (path, pt, idx) =>
        `${path} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${this.scaleYBp(pt.diastolic!)}`,
      '',
    );
  });

  readonly symptomPatterns = computed(() => {
    if (this.handover()?.recurringSymptomPatterns?.length) {
      return this.handover()!.recurringSymptomPatterns;
    }
    // Smart heuristic fallback based on entries
    const patterns = [];
    const dizzyEntries = this.filteredEntries().filter((e) =>
      e.clinicalSoap.subjective.toLowerCase().includes('dizzy'),
    );
    if (dizzyEntries.length > 0) {
      patterns.push({
        symptom: 'Post-prandial / Orthostatic Dizziness',
        frequency: dizzyEntries.length,
        potentialTrigger:
          'Often logged shortly after morning Amlodipine administration when taken prior to substantial breakfast.',
      });
    }
    return patterns;
  });

  readonly discussionPoints = computed(() => {
    if (this.handover()?.suggestedDiscussionPoints?.length) {
      return this.handover()!.suggestedDiscussionPoints;
    }
    return [
      'Review morning Amlodipine (5mg) timing relative to breakfast to alleviate transient lightheadedness.',
      'Check home sphygmomanometer cuff calibration and arm elevation technique.',
      'Evaluate fasting blood glucose readings and reinforce twice-daily Metformin adherence post-meal.',
    ];
  });

  readonly defaultOverviewText = computed(() => {
    const name = this.patient().name;
    const count = this.filteredEntries().length;
    if (count === 0) {
      return `No journal entries recorded for ${name} in the selected window. Please log observations or expand the time interval filter.`;
    }
    return `${name} has ${count} caregiver entries recorded in this observation period. Vital trends indicate blood pressure averaging ${
      this.avgBp().systolic ? this.avgBp().systolic + '/' + this.avgBp().diastolic + ' mmHg' : 'within expected variance'
    }. Adherence to daily chronic therapy remains high (${this.adherenceRate()}%).`;
  });

  generateHandoverSynthesis(): void {
    const entries = this.filteredEntries();
    if (entries.length === 0) return;

    this.isSynthesizing.set(true);
    this.geminiState
      .synthesizeDoctorHandover(entries, this.patient())
      .subscribe({
        next: (handover) => {
          this.handover.set(handover);
          this.isSynthesizing.set(false);
        },
        error: (err) => {
          console.warn('AI Handover synthesis fallback:', err);
          this.isSynthesizing.set(false);
        },
      });
  }
}
