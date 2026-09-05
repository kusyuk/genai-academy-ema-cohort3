import {Injectable, signal} from '@angular/core';
import {initializeApp, getApps, getApp} from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import {
  PatientProfile,
  ClinicalEntry,
  DEFAULT_PATIENT_PROFILE,
  SAMPLE_HISTORICAL_ENTRIES,
} from '../models/clinical';

export interface ReflectionTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  title: string;
  mode: 'reflection' | 'brainstorm' | 'action_plan' | 'gratitude';
  turns: ReflectionTurn[];
  summary?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Strips all undefined values recursively from objects to ensure zero-crash Firestore writes.
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeFirestorePayload(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      clean[key] = sanitizeFirestorePayload(value);
    }
  }
  return clean as T;
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseState {
  readonly currentUser = signal<UserProfile | null>(null);
  readonly isAuthLoading = signal<boolean>(true);
  readonly authError = signal<string | null>(null);
  readonly activePatient = signal<PatientProfile>(DEFAULT_PATIENT_PROFILE);
  readonly currentRole = signal<'caregiver' | 'doctor'>('caregiver');

  private readonly app =
    getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  private readonly auth = getAuth(this.app);
  private readonly db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(this.app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(this.app);

  constructor() {
    this.initAuthListener();
    this.testConnection();
  }

  private async testConnection(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      await getDocFromServer(doc(this.db, 'test', 'connection'));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('the client is offline')
      ) {
        console.warn('Firestore offline status check:', error.message);
      }
    }
  }

  private initAuthListener(): void {
    if (typeof window === 'undefined') {
      this.isAuthLoading.set(false);
      return;
    }

    onAuthStateChanged(
      this.auth,
      (user: User | null) => {
        if (user) {
          this.currentUser.set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
        } else {
          this.currentUser.set(null);
        }
        this.isAuthLoading.set(false);
      },
      (error) => {
        console.error('Firebase Auth state error:', error);
        this.authError.set(error.message);
        this.isAuthLoading.set(false);
      },
    );
  }

  async signInWithGoogle(): Promise<UserProfile | null> {
    this.authError.set(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(this.auth, provider);
      const user = credential.user;
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      this.currentUser.set(profile);
      return profile;
    } catch (error: unknown) {
      console.error('Google Sign-In failed:', error);
      const msg =
        error instanceof Error ? error.message : 'Google sign-in was cancelled or failed.';
      this.authError.set(msg);
      throw error;
    }
  }


  async signOut(): Promise<void> {
    try {
      if (this.auth.currentUser) {
        await firebaseSignOut(this.auth);
      }
      this.currentUser.set(null);
    } catch (error: unknown) {
      console.error('Sign-out error:', error);
      this.currentUser.set(null);
    }
  }

  private getUserInteractionsCollection(userId: string) {
    return collection(this.db, 'users', userId, 'interactions');
  }

  async fetchUserInteractions(userId: string): Promise<JournalInteraction[]> {
    try {
      const collRef = this.getUserInteractionsCollection(userId);
      const q = query(collRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const results: JournalInteraction[] = [];
      snapshot.forEach((d) => {
        results.push(d.data() as JournalInteraction);
      });
      return results;
    } catch (error) {
      console.error('Failed to fetch user journal interactions:', error);
      throw error;
    }
  }

  async saveInteraction(
    userId: string,
    interaction: JournalInteraction,
  ): Promise<void> {
    try {
      const docRef = doc(
        this.db,
        'users',
        userId,
        'interactions',
        interaction.id,
      );
      const sanitized = sanitizeFirestorePayload(interaction);
      await setDoc(docRef, sanitized, { merge: true });
    } catch (error) {
      console.error('Failed to save journal interaction in Firestore:', error);
      throw error;
    }
  }

  async deleteInteraction(userId: string, interactionId: string): Promise<void> {
    try {
      const docRef = doc(
        this.db,
        'users',
        userId,
        'interactions',
        interactionId,
      );
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete journal interaction:', error);
      throw error;
    }
  }

  // ==========================================
  // EMA Clinical Data Layer (Per-User Isolation)
  // ==========================================

  async fetchPatientProfile(userId: string): Promise<PatientProfile> {
    try {
      const docRef = doc(this.db, 'users', userId, 'profile', 'patient');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as PatientProfile;
        this.activePatient.set(data);
        return data;
      }
      // Return and persist default profile if greenfield
      const initial = { ...DEFAULT_PATIENT_PROFILE, primaryCaregiverUid: userId };
      await this.savePatientProfile(userId, initial);
      this.activePatient.set(initial);
      return initial;
    } catch (error) {
      console.warn('Failed to fetch patient profile, using local default:', error);
      return this.activePatient();
    }
  }

  async savePatientProfile(userId: string, profile: PatientProfile): Promise<void> {
    try {
      const docRef = doc(this.db, 'users', userId, 'profile', 'patient');
      const sanitized = sanitizeFirestorePayload(profile);
      await setDoc(docRef, sanitized, { merge: true });
      this.activePatient.set(profile);
    } catch (error) {
      console.error('Failed to save patient profile:', error);
      throw error;
    }
  }

  async fetchClinicalEntries(userId: string): Promise<ClinicalEntry[]> {
    try {
      const collRef = collection(this.db, 'users', userId, 'clinicalEntries');
      const q = query(collRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const results: ClinicalEntry[] = [];
      snapshot.forEach((d) => {
        results.push(d.data() as ClinicalEntry);
      });
      return results;
    } catch (error) {
      console.error('Failed to fetch clinical entries:', error);
      return [];
    }
  }

  async saveClinicalEntry(userId: string, entry: ClinicalEntry): Promise<void> {
    try {
      const docRef = doc(this.db, 'users', userId, 'clinicalEntries', entry.id);
      const sanitized = sanitizeFirestorePayload(entry);
      await setDoc(docRef, sanitized, { merge: true });
    } catch (error) {
      console.error('Failed to save clinical entry:', error);
      throw error;
    }
  }

  async deleteClinicalEntry(userId: string, entryId: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'users', userId, 'clinicalEntries', entryId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete clinical entry:', error);
      throw error;
    }
  }

  async seedSampleHistoricalEntries(userId: string): Promise<ClinicalEntry[]> {
    try {
      const existing = await this.fetchClinicalEntries(userId);
      if (existing.length > 0) return existing;

      const seeded: ClinicalEntry[] = [];
      for (const entry of SAMPLE_HISTORICAL_ENTRIES) {
        const entryToSave: ClinicalEntry = {
          ...entry,
          authorUid: userId,
        };
        await this.saveClinicalEntry(userId, entryToSave);
        seeded.push(entryToSave);
      }
      return seeded;
    } catch (error) {
      console.warn('Failed to seed sample historical entries:', error);
      return [];
    }
  }
}
