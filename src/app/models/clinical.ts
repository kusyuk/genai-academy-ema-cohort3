export interface ChronicCondition {
  condition: string;
  diagnosedYear: number;
}

export interface Allergy {
  allergen: string;
  reaction: string;
  severity: 'low' | 'moderate' | 'high';
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  timing: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  purpose: string;
  instructions?: string;
}

export interface BaselineVitals {
  targetBpSystolic: number;
  targetBpDiastolic: number;
  fastingBloodSugarRange: string;
}

export interface PatientProfile {
  id: string;
  name: string;
  birthYear: number;
  gender: 'female' | 'male' | 'other';
  primaryCaregiverUid: string;
  chronicConditions: ChronicCondition[];
  allergies: Allergy[];
  currentMedications: Medication[];
  surgicalHistory: string[];
  baselineVitals: BaselineVitals;
  lastDoctorAppointment?: string;
  updatedAt: string;
}

export interface BloodPressureMetric {
  systolic: number | null;
  diastolic: number | null;
}

export interface ExtractedMetrics {
  bloodPressure?: BloodPressureMetric;
  bloodGlucose?: number | null;
  temperature?: number | null;
}

export interface GroundedAnalysis {
  potentialDrugInteractionOrConflict?: string | null;
  conditionRelevance: string[];
  adherenceFlag?: string | null;
}

export interface ClinicalSoap {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SafetyAlert {
  level: 'info' | 'warning' | 'urgent';
  message: string;
}

export interface GoogleTaskDirective {
  taskId?: string;
  title: string;
  dueMinutesFromNow?: number;
  notes?: string;
  synced?: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

export interface ClinicalEntry {
  id: string;
  patientId: string;
  createdAt: string;
  authorUid: string;
  authorRole: 'caregiver' | 'doctor';
  conversationTranscript: ConversationTurn[];
  groundedAnalysis: GroundedAnalysis;
  extractedMetrics: ExtractedMetrics;
  clinicalSoap: ClinicalSoap;
  safetyAlert?: SafetyAlert | null;
  googleTasksDirectives: GoogleTaskDirective[];
  doctorConsultBullet: string;
}

export interface ConsultationHandover {
  periodCovered: {
    from: string;
    to: string;
  };
  aiSynthesizedOverview: string;
  adherenceRatePercentage: number;
  vitalsSummary: {
    avgSystolic: number;
    avgDiastolic: number;
    avgGlucose: number | null;
    notableOutliers: string[];
  };
  recurringSymptomPatterns: {
    symptom: string;
    frequency: number;
    potentialTrigger: string;
  }[];
  suggestedDiscussionPoints: string[];
}

export const DEFAULT_PATIENT_PROFILE: PatientProfile = {
  id: 'patient_aminah_1952',
  name: 'Hajjah Aminah',
  birthYear: 1952,
  gender: 'female',
  primaryCaregiverUid: '',
  chronicConditions: [
    { condition: 'Type 2 Diabetes Mellitus', diagnosedYear: 2015 },
    { condition: 'Hypertension', diagnosedYear: 2018 },
  ],
  allergies: [
    {
      allergen: 'Penicillin',
      reaction: 'Skin rash / anaphylaxis risk',
      severity: 'high',
    },
  ],
  currentMedications: [
    {
      name: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Once daily',
      timing: 'Morning',
      purpose: 'Blood pressure control',
      instructions: 'Take in morning with breakfast; avoid empty stomach.',
    },
    {
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      timing: 'Morning',
      purpose: 'Blood glucose management',
      instructions: 'Take after meals.',
    },
  ],
  surgicalHistory: ['Cataract extraction (2022)'],
  baselineVitals: {
    targetBpSystolic: 130,
    targetBpDiastolic: 80,
    fastingBloodSugarRange: '5.0 - 7.0 mmol/L',
  },
  lastDoctorAppointment: '2026-08-15T09:00:00Z',
  updatedAt: new Date().toISOString(),
};
