import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {
  PatientProfile,
  ClinicalEntry,
  ConsultationHandover,
  GoogleTaskDirective,
  ClinicalSoap,
  ExtractedMetrics,
  GroundedAnalysis,
  SafetyAlert,
} from '../models/clinical';

export interface ClarifyResponse {
  hasSufficientContext: boolean;
  clarificationQuestion: string | null;
  instantReplyOptions: string[];
  interimAlert: string | null;
  modelUsed?: string;
  timestamp?: string;
}

export interface FinalizeResponse {
  clinicalSoap: ClinicalSoap;
  extractedMetrics: ExtractedMetrics;
  groundedAnalysis: GroundedAnalysis;
  safetyAlert?: SafetyAlert | null;
  googleTasksDirectives: GoogleTaskDirective[];
  doctorConsultBullet: string;
  modelUsed?: string;
  timestamp?: string;
}

export interface TaskSyncResponse {
  success: boolean;
  taskId: string;
  title: string;
  patientName: string;
  dueDate: string;
  notes: string;
  syncedAt: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  aiConfigured: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class GeminiState {
  private readonly http = inject(HttpClient);

  checkHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>('/api/health').pipe(
      catchError((err) => {
        console.error('Health check failed:', err);
        return throwError(() => new Error('Backend service is unreachable.'));
      }),
    );
  }

  clarifyObservation(
    prompt: string,
    history: { role: 'user' | 'model'; text: string }[],
    patientProfile: PatientProfile,
  ): Observable<ClarifyResponse> {
    return this.http
      .post<ClarifyResponse>('/api/chat/clarify', {
        prompt,
        history,
        patientProfile,
      })
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.error || err?.message || 'Failed to clarify observation.';
          return throwError(() => new Error(errorMsg));
        }),
      );
  }

  finalizeEntry(
    history: { role: 'user' | 'model'; text: string }[],
    patientProfile: PatientProfile,
  ): Observable<FinalizeResponse> {
    return this.http
      .post<FinalizeResponse>('/api/chat/finalize', {
        history,
        patientProfile,
      })
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.error || err?.message || 'Failed to compile clinical SOAP record.';
          return throwError(() => new Error(errorMsg));
        }),
      );
  }

  synthesizeDoctorHandover(
    entries: ClinicalEntry[],
    patientProfile: PatientProfile,
  ): Observable<ConsultationHandover> {
    return this.http
      .post<ConsultationHandover>('/api/doctor-handover', {
        entries,
        patientProfile,
      })
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.error || err?.message || 'Failed to generate Doctor Consultation Handover brief.';
          return throwError(() => new Error(errorMsg));
        }),
      );
  }

  syncTask(
    directive: GoogleTaskDirective,
    patientName: string,
    accessToken?: string | null,
  ): Observable<TaskSyncResponse> {
    return this.http
      .post<TaskSyncResponse>('/api/tasks/sync', {
        directive,
        patientName,
        accessToken,
      })
      .pipe(
        catchError((err) => {
          const errorMsg =
            err?.error?.error || err?.message || 'Failed to sync directive with Google Tasks.';
          return throwError(() => new Error(errorMsg));
        }),
      );
  }

  // Backward compatibility
  reflect(
    prompt: string,
    mode: string,
    title: string,
    history: { role: 'user' | 'model'; text: string }[],
  ) {
    return this.http.post<any>('/api/gemini/reflect', { prompt, mode, title, history });
  }

  summarize(title: string, entries: { role: 'user' | 'model'; text: string }[]) {
    return this.http.post<any>('/api/gemini/summarize', { title, entries });
  }
}
