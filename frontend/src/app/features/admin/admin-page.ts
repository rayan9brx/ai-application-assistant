import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdminAudit } from './admin-audit';
import { AdminCvs } from './admin-cvs';
import { AdminOnboarding } from './admin-onboarding';
import { AdminOverview } from './admin-overview';
import { AdminPrompts } from './admin-prompts';
import { AdminUsers } from './admin-users';
import { Logo } from '../../shared/logo';

type AdminTab = 'overview' | 'onboarding' | 'prompts' | 'users' | 'cvs' | 'audit';

/**
 * /admin, behind adminGuard. The guard only hides the page: every /api/admin request is checked
 * again on the server, which answers 403 to non-admins.
 */
@Component({
  selector: 'app-admin-page',
  imports: [AdminAudit, AdminCvs, AdminOnboarding, AdminOverview, AdminPrompts, AdminUsers, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <div class="brand-row"><app-logo variant="white" [size]="22" /><p class="pill-badge">Admin</p></div>
      <h1>Admin dashboard</h1>
      <p class="muted">Cookieless analytics: no IP addresses or cookies are stored. Admin visits aren’t counted.</p>
    </header>
    <div class="tabs" role="tablist" aria-label="Admin sections">
      @for (t of tabs; track t.id) {
        <button type="button" role="tab" [id]="'tab-' + t.id" [attr.aria-selected]="tab() === t.id"
          [attr.aria-controls]="'panel-' + t.id" [tabIndex]="tab() === t.id ? 0 : -1" (click)="select(t.id)"
          (keydown.arrowRight)="move(1)" (keydown.arrowLeft)="move(-1)">{{ t.label }}</button>
      }
    </div>
    <!-- Tabs stay mounted once opened, so searches and pages survive switching. -->
    <section role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" [hidden]="tab() !== 'overview'">
      <app-admin-overview />
    </section>
    <section role="tabpanel" id="panel-onboarding" aria-labelledby="tab-onboarding" [hidden]="tab() !== 'onboarding'">
      @if (opened().has('onboarding')) { <app-admin-onboarding /> }
    </section>
    <section role="tabpanel" id="panel-prompts" aria-labelledby="tab-prompts" [hidden]="tab() !== 'prompts'">
      @if (opened().has('prompts')) { <app-admin-prompts /> }
    </section>
    <section role="tabpanel" id="panel-users" aria-labelledby="tab-users" [hidden]="tab() !== 'users'">
      @if (opened().has('users')) { <app-admin-users /> }
    </section>
    <section role="tabpanel" id="panel-cvs" aria-labelledby="tab-cvs" [hidden]="tab() !== 'cvs'">
      @if (opened().has('cvs')) { <app-admin-cvs (logged)="auditVersion.set(auditVersion() + 1)" /> }
    </section>
    <section role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" [hidden]="tab() !== 'audit'">
      @if (opened().has('audit')) { <app-admin-audit [version]="auditVersion()" /> }
    </section>
  `,
  styles: `
    :host { display: block; padding-block: var(--space-6); }
    .head { margin-bottom: var(--space-5); }
    .brand-row { display: flex; align-items: center; gap: var(--space-4); }
    .head h1 { margin: var(--space-3) 0 var(--space-1); }
    .muted { color: var(--text-secondary); font-size: var(--text-sm); }
    .tabs { display: flex; gap: var(--space-1); margin-bottom: var(--space-5); border-bottom: 1px solid var(--border); overflow-x: auto; }
    .tabs button { min-height: 42px; margin-bottom: -1px; padding: 8px 16px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--text-secondary); white-space: nowrap; }
    .tabs button[aria-selected='true'] { border-bottom-color: var(--accent); color: var(--text); }
    .tabs button:hover { color: var(--text); }
  `,
})
export class AdminPage {
  readonly tabs: { id: AdminTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'prompts', label: 'What users ask for' },
    { id: 'users', label: 'Users' },
    { id: 'cvs', label: 'CVs' },
    { id: 'audit', label: 'Audit log' },
  ];
  private readonly current = signal<AdminTab>('overview');
  readonly opened = signal(new Set<AdminTab>(['overview']));
  readonly auditVersion = signal(0);

  readonly tab = this.current.asReadonly();

  select(id: AdminTab): void {
    this.current.set(id);
    if (!this.opened().has(id)) this.opened.update((set) => new Set(set).add(id));
  }

  move(step: number): void {
    const i = this.tabs.findIndex((t) => t.id === this.current());
    const next = this.tabs[(i + step + this.tabs.length) % this.tabs.length];
    this.select(next.id);
    document.getElementById('tab-' + next.id)?.focus();
  }
}
