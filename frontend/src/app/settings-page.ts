import { Component, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { CvApi, Profile } from './cv-api';
import { CvFlow } from './cv-flow';
import { Navigation } from './navigation';
import { MIN_PASSWORD } from './signup-page';

const PLAN_LABELS: Record<Profile['plan'], string> = { free: 'Free', pro: 'Pro', lifetime: 'Lifetime' };

/** /settings: name, password, plan and account deletion. */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.html',
  styleUrls: ['./account-forms.scss', './settings-page.scss'],
})
export class SettingsPage {
  private readonly api = inject(CvApi);
  private readonly navigation = inject(Navigation);
  readonly auth = inject(AuthService);
  readonly minPassword = MIN_PASSWORD;

  readonly profile = signal<Profile | null>(null);
  readonly loadError = signal('');
  readonly name = signal('');
  readonly nameState = signal<{ busy?: boolean; error?: string; done?: boolean }>({});
  readonly password = signal('');
  readonly passwordState = signal<{ busy?: boolean; error?: string; done?: boolean }>({});
  readonly confirmText = signal('');
  readonly deleteState = signal<{ busy?: boolean; error?: string }>({});

  constructor() {
    this.api.me().then(
      (profile) => {
        this.profile.set(profile);
        this.name.set(profile.fullName ?? '');
      },
      (error) => this.loadError.set(CvFlow.message(error, 'Your settings couldn’t be loaded.')),
    );
  }

  planLabel(plan: Profile['plan']): string {
    return PLAN_LABELS[plan] ?? plan;
  }

  async saveName(event: Event): Promise<void> {
    event.preventDefault();
    if (this.nameState().busy) return;
    this.nameState.set({ busy: true });
    try {
      this.profile.set(await this.api.updateMe(this.name().trim()));
      // Keep the name shown in the navbar (from the auth session) in step.
      await this.auth.updateName(this.name()).catch(() => undefined);
      this.nameState.set({ done: true });
    } catch (error) {
      this.nameState.set({ error: CvFlow.message(error, 'Saving your name failed.') });
    }
  }

  async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwordState().busy) return;
    if (this.password().length < MIN_PASSWORD) {
      this.passwordState.set({ error: `Use a password of at least ${MIN_PASSWORD} characters.` });
      return;
    }
    this.passwordState.set({ busy: true });
    try {
      await this.auth.updatePassword(this.password());
      this.password.set('');
      this.passwordState.set({ done: true });
    } catch (error) {
      this.passwordState.set({ error: AuthService.message(error, 'Changing your password failed.') });
    }
  }

  async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();
    if (this.deleteState().busy || this.confirmText().trim() !== 'DELETE') return;
    this.deleteState.set({ busy: true });
    try {
      await this.api.deleteMe();
      await this.auth.signOut();
      await this.navigation.go('/');
    } catch (error) {
      this.deleteState.set({
        error: CvFlow.message(error, 'Deleting your account failed. Nothing was deleted.'),
      });
    }
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
