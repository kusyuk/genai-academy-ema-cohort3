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
  potentialMedicineInteractionOrConflict?: string | null;
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
  isLocalFallback?: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
  interimAlert?: string | null;
  instantReplies?: string[];
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

export const SAMPLE_HISTORICAL_ENTRIES: ClinicalEntry[] = [
  {
    id: 'entry_sample_01',
    patientId: 'patient_aminah_1952',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    authorUid: '',
    authorRole: 'caregiver',
    conversationTranscript: [
      {
        role: 'user',
        text: 'Mother took morning Amlodipine and Metformin after oatmeal breakfast. BP is 122/78 and fasting glucose is 6.2.',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      },
      {
        role: 'model',
        text: 'Did she experience any dizziness or fatigue this morning?',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 30000).toISOString(),
        instantReplies: ['No dizziness today', 'Mild fatigue only', 'Feeling energetic'],
      },
      {
        role: 'user',
        text: 'Feeling energetic, no dizziness today.',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000 + 60000).toISOString(),
      },
    ],
    groundedAnalysis: {
      potentialMedicineInteractionOrConflict: null,
      potentialDrugInteractionOrConflict: null,
      conditionRelevance: ['Hypertension', 'Type 2 Diabetes Mellitus'],
      adherenceFlag: 'Adherent with meal-timing instructions',
    },
    extractedMetrics: {
      bloodPressure: { systolic: 122, diastolic: 78 },
      bloodGlucose: 6.2,
      temperature: 36.6,
    },
    clinicalSoap: {
      subjective: 'Patient had oatmeal breakfast followed by prescribed morning Amlodipine and Metformin. Caregiver reports high energy, no dizziness.',
      objective: 'BP 122/78 mmHg, Fasting Glucose 6.2 mmol/L. Ambulatory and alert.',
      assessment: 'Optimal blood pressure and glycemic stability on current baseline regimen.',
      plan: 'Continue current morning doses with meals. Maintain routine hydration.',
    },
    safetyAlert: null,
    googleTasksDirectives: [
      {
        title: 'Administer Metformin 500mg with dinner',
        dueMinutesFromNow: 480,
        notes: 'Take after evening meal.',
        synced: true,
      },
    ],
    doctorConsultBullet: 'BP 122/78, Glucose 6.2. Excellent medication tolerance and baseline stability.',
  },
  {
    id: 'entry_sample_02',
    patientId: 'patient_aminah_1952',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    authorUid: '',
    authorRole: 'caregiver',
    conversationTranscript: [
      {
        role: 'user',
        text: 'Mother felt lightheaded after standing up quickly from the armchair after lunch. BP was 138/86, glucose was 8.4.',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      },
      {
        role: 'model',
        text: 'Is she currently resting in a seated position and able to drink water?',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 30000).toISOString(),
        interimAlert: 'Ensure patient rests in seated position to prevent fall risk.',
        instantReplies: ['Yes, resting seated', 'Drinking warm water now'],
      },
      {
        role: 'user',
        text: 'Yes, resting seated and drinking warm water now.',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000 + 60000).toISOString(),
      },
    ],
    groundedAnalysis: {
      potentialMedicineInteractionOrConflict: 'Post-prandial orthostatic change noted after sudden standing.',
      potentialDrugInteractionOrConflict: 'Post-prandial orthostatic change noted after sudden standing.',
      conditionRelevance: ['Hypertension'],
      adherenceFlag: 'Prescriptions taken on time',
    },
    extractedMetrics: {
      bloodPressure: { systolic: 138, diastolic: 86 },
      bloodGlucose: 8.4,
    },
    clinicalSoap: {
      subjective: 'Caregiver observed transient postural dizziness upon standing quickly after lunch. Resolved with seated rest and hydration.',
      objective: 'BP 138/86 mmHg, 2-hour postprandial glucose 8.4 mmol/L. No syncope.',
      assessment: 'Mild orthostatic lightheadedness; borderline systolic elevation.',
      plan: 'Encourage slow postural transitions. Re-check BP before evening meal.',
    },
    safetyAlert: {
      level: 'warning',
      message: 'Postural lightheadedness observed. Advised slow standing transitions to avoid fall risks.',
    },
    googleTasksDirectives: [
      {
        title: 'Check Hajjah Aminah evening BP',
        dueMinutesFromNow: 240,
        notes: 'Target BP < 130/80 mmHg.',
        synced: true,
      },
    ],
    doctorConsultBullet: 'BP 138/86, Glucose 8.4. Transient postural dizziness; resolved after seated rest.',
  },
  {
    id: 'entry_sample_03',
    patientId: 'patient_aminah_1952',
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    authorUid: '',
    authorRole: 'caregiver',
    conversationTranscript: [
      {
        role: 'user',
        text: 'Morning vitals check: BP 120/75, fasting blood sugar 5.8. Took morning medications with eggs and toast. Completed 20 minutes garden walk.',
        timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      },
    ],
    groundedAnalysis: {
      potentialMedicineInteractionOrConflict: null,
      potentialDrugInteractionOrConflict: null,
      conditionRelevance: ['Hypertension', 'Type 2 Diabetes Mellitus'],
      adherenceFlag: 'Fully adherent',
    },
    extractedMetrics: {
      bloodPressure: { systolic: 120, diastolic: 75 },
      bloodGlucose: 5.8,
    },
    clinicalSoap: {
      subjective: 'Patient completed 20 minutes of light garden walking. Full adherence to morning dietary instructions.',
      objective: 'BP 120/75 mmHg, Fasting Glucose 5.8 mmol/L. Euvolemic, active.',
      assessment: 'Target blood pressure and glucose achieved. Strong physical endurance.',
      plan: 'Maintain regular light aerobic activity and balanced nutrition.',
    },
    safetyAlert: null,
    googleTasksDirectives: [],
    doctorConsultBullet: 'BP 120/75, Glucose 5.8. Optimal metrics achieved with 20min physical mobility.',
  },
  {
    id: 'entry_sample_04',
    patientId: 'patient_aminah_1952',
    createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    authorUid: '',
    authorRole: 'caregiver',
    conversationTranscript: [
      {
        role: 'user',
        text: 'Mother took morning Amlodipine on empty stomach before breakfast because we had an early errand. BP was 142/88. She felt slightly nauseous.',
        timestamp: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
      },
    ],
    groundedAnalysis: {
      potentialMedicineInteractionOrConflict: 'Amlodipine taken on an empty stomach paired with a skipped morning meal precipitated nausea and reactive systolic elevation.',
      potentialDrugInteractionOrConflict: 'Amlodipine taken on an empty stomach paired with a skipped morning meal precipitated nausea and reactive systolic elevation.',
      conditionRelevance: ['Hypertension'],
      adherenceFlag: 'Food-timing adherence failure',
    },
    extractedMetrics: {
      bloodPressure: { systolic: 142, diastolic: 88 },
      bloodGlucose: 7.0,
    },
    clinicalSoap: {
      subjective: 'Caregiver reports Amlodipine ingested without food prior to scheduled breakfast. Patient felt nausea and slight head pressure.',
      objective: 'BP 142/88 mmHg, Glucose 7.0 mmol/L.',
      assessment: 'Acute adherence conflict: antihypertensive taken without breakfast resulted in gastric irritation and reactive systolic hypertension.',
      plan: 'Administered light snack. Emphasized strictly pairing Amlodipine with meals.',
    },
    safetyAlert: {
      level: 'warning',
      message: 'Medication taken without food. Always pair Amlodipine with breakfast to avoid orthostatic dizziness.',
    },
    googleTasksDirectives: [],
    doctorConsultBullet: 'BP 142/88. Adherence conflict: Amlodipine taken without breakfast caused nausea.',
  },
];
