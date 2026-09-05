import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {FirebaseState} from '../services/firebase';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-account-modal',
  imports: [MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div class="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <mat-icon class="text-lg">account_circle</mat-icon>
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-slate-900 leading-tight">Account &amp; Caregiver Profile</h2>
              <p class="text-[11px] text-slate-500">Authenticated user identity &amp; security settings</p>
            </div>
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Close modal"
          >
            <mat-icon class="text-lg">close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5 text-xs text-slate-700">
          @if (currentUser(); as u) {
            <!-- User Identity Card -->
            <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3.5">
              @if (u.photoURL) {
                <img
                  [src]="u.photoURL"
                  [alt]="u.displayName || 'User Avatar'"
                  referrerpolicy="no-referrer"
                  class="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0"
                />
              } @else {
                <div class="w-14 h-14 rounded-2xl bg-teal-800 text-white text-xl font-bold flex items-center justify-center shadow-2xs shrink-0">
                  {{ (u.displayName || u.email || 'U').charAt(0).toUpperCase() }}
                </div>
              }
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-sm sm:text-base text-slate-900 truncate leading-tight">
                    {{ u.displayName || 'Caregiver User' }}
                  </h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200/80">
                    {{ currentRole() === 'doctor' ? 'Physician' : 'Caregiver' }}
                  </span>
                </div>
                <p class="text-xs text-slate-600 truncate mt-0.5">{{ u.email }}</p>
                <div class="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                  <mat-icon class="text-xs text-emerald-600">verified_user</mat-icon>
                  <span>Google Authentication Verified</span>
                </div>
              </div>
            </div>

            <!-- Details List: User ID & Session Info -->
            <div class="space-y-2.5">
              <!-- User ID Row with Copy Affordance -->
              <div class="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs">
                <div class="min-w-0">
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">User Identifier (UID)</span>
                  <span class="font-mono text-xs text-slate-800 truncate block max-w-[240px] sm:max-w-[280px]">
                    {{ u.uid }}
                  </span>
                </div>
                <button
                  type="button"
                  (click)="copyUserId(u.uid)"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-600 hover:text-slate-900 transition cursor-pointer flex items-center gap-1 shrink-0 text-[11px]"
                  [title]="copiedId() ? 'Copied to clipboard' : 'Copy UID to clipboard'"
                >
                  <mat-icon class="text-sm text-teal-700">{{ copiedId() ? 'check' : 'content_copy' }}</mat-icon>
                  <span>{{ copiedId() ? 'Copied' : 'Copy' }}</span>
                </button>
              </div>

              <!-- Gmail & Provider Row -->
              <div class="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs">
                <div>
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Primary Email</span>
                  <span class="text-xs text-slate-800 font-medium">{{ u.email }}</span>
                </div>
                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                  Google Workspace
                </span>
              </div>
            </div>

            @if (deleteError()) {
              <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <mat-icon class="text-sm text-amber-600 shrink-0 mt-0.5">warning</mat-icon>
                <span>{{ deleteError() }}</span>
              </div>
            }

            <!-- Danger Zone / Actions -->
            <div class="pt-2 border-t border-slate-100 space-y-2">
              @if (!confirmDeleteMode()) {
                <!-- Sign Out Action -->
                <button
                  id="btn-modal-signout"
                  type="button"
                  (click)="handleSignOut()"
                  class="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                >
                  <mat-icon class="text-base">logout</mat-icon>
                  <span>Sign Out of EMA</span>
                </button>

                <!-- Delete Account Action -->
                <button
                  id="btn-modal-delete-account"
                  type="button"
                  (click)="confirmDeleteMode.set(true)"
                  class="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 active:scale-98 text-rose-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                >
                  <mat-icon class="text-base text-rose-600">delete_forever</mat-icon>
                  <span>Delete Account &amp; Clinical Data</span>
                </button>
              } @else {
                <!-- Destructive Confirmation Step -->
                <div class="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-3">
                  <div class="flex items-start gap-2 text-rose-900">
                    <mat-icon class="text-lg text-rose-600 shrink-0 mt-0.5">report_problem</mat-icon>
                    <div>
                      <h4 class="font-bold text-xs text-rose-900">Permanently Delete Account?</h4>
                      <p class="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                        This will permanently delete your authentication record and all locally synced clinical entries. This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 justify-end pt-1">
                    <button
                      type="button"
                      (click)="confirmDeleteMode.set(false)"
                      [disabled]="isDeleting()"
                      class="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-95 text-xs font-semibold text-slate-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-delete-account"
                      type="button"
                      (click)="executeDeleteAccount()"
                      [disabled]="isDeleting()"
                      class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs font-bold text-white transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      @if (isDeleting()) {
                        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Deleting...</span>
                      } @else {
                        <mat-icon class="text-sm">delete_forever</mat-icon>
                        <span>Yes, Delete Account</span>
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="py-8 text-center text-slate-400 space-y-2">
              <mat-icon class="text-4xl text-slate-300">account_circle</mat-icon>
              <p class="text-xs">No authenticated session active.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class UserAccountModal {
  private readonly firebaseState = inject(FirebaseState);

  readonly close = output<void>();

  readonly currentUser = this.firebaseState.currentUser;
  readonly currentRole = this.firebaseState.currentRole;

  readonly copiedId = signal<boolean>(false);
  readonly confirmDeleteMode = signal<boolean>(false);
  readonly isDeleting = signal<boolean>(false);
  readonly deleteError = signal<string | null>(null);

  async copyUserId(uid: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(uid);
      this.copiedId.set(true);
      setTimeout(() => this.copiedId.set(false), 2500);
    }
  }

  async handleSignOut(): Promise<void> {
    await this.firebaseState.signOut();
    this.close.emit();
  }

  async executeDeleteAccount(): Promise<void> {
    this.isDeleting.set(true);
    this.deleteError.set(null);
    const res = await this.firebaseState.deleteAccount();
    this.isDeleting.set(false);
    if (res.success) {
      this.close.emit();
    } else {
      this.deleteError.set(res.error || 'Failed to delete account.');
    }
  }
}
