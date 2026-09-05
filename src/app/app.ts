import {ChangeDetectionStrategy, Component, effect, inject, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {Landing} from './landing/landing';
import {Dashboard} from './dashboard/dashboard';
import {FirebaseState} from './services/firebase';
import {PatientProfileModal} from './components/patient-profile-modal';
import {OnboardingModal} from './components/onboarding-modal';
import {UserAccountModal} from './components/user-account-modal';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule, Landing, Dashboard, PatientProfileModal, OnboardingModal, UserAccountModal],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly firebaseState = inject(FirebaseState);

  readonly user = this.firebaseState.currentUser;
  readonly isLoading = this.firebaseState.isAuthLoading;
  readonly currentRole = this.firebaseState.currentRole;
  readonly activePatient = this.firebaseState.activePatient;
  readonly isProfileModalOpen = signal<boolean>(false);
  readonly isUserAccountModalOpen = this.firebaseState.isUserAccountModalOpen;
  readonly isOnboardingOpen = signal<boolean>(false);

  constructor() {
    effect(() => {
      const u = this.user();
      if (u && typeof window !== 'undefined') {
        const completed = localStorage.getItem('ema_onboarding_completed');
        if (completed !== 'true') {
          this.isOnboardingOpen.set(true);
        }
      }
    });
  }

  setRole(role: 'caregiver' | 'doctor'): void {
    this.firebaseState.currentRole.set(role);
  }

  async handleSignOut(): Promise<void> {
    try {
      await this.firebaseState.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  async handleSignIn(): Promise<void> {
    try {
      await this.firebaseState.signInWithGoogle();
    } catch (err) {
      console.error('Sign in error:', err);
    }
  }
}
