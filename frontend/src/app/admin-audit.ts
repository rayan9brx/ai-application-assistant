import { ChangeDetectionStrategy, Component, inject, input, effect, signal, untracked } from '@angular/core';
import { AdminApi, AdminPage, AuditEntry } from './admin-api';
import { CvFlow } from './cv-flow';

/** Audit log tab: every admin view of a CV's content, newest first. */
@Component({
  selector: 'app-admin-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Admin</th><th>CV</th><th>Owner</th><th>Reason</th></tr></thead>
        <tbody>
          @for (e of page()?.items ?? []; track e.id) {
            <tr>
              <td>{{ date(e.createdAt) }}</td>
              <td><span class="ellipsis">{{ e.adminEmail ?? '–' }}</span></td>
              <td><span class="ellipsis" [title]="e.cvTitle ?? ''">{{ e.cvTitle ?? (e.cvId ? '–' : 'Deleted CV') }}</span></td>
              <td><span class="ellipsis">{{ e.ownerEmail ?? '–' }}</span></td>
              <td class="wrap">{{ e.reason }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty-row">{{ loading() ? 'Loading…' : 'No CV has been viewed yet.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (page(); as p) {
      <div class="pager">
        <button type="button" [disabled]="p.page === 0 || loading()" (click)="load(p.page - 1)">Previous</button>
        <span>Page {{ p.page + 1 }} of {{ pages(p) }}</span>
        <button type="button" [disabled]="p.page + 1 >= pages(p) || loading()" (click)="load(p.page + 1)">Next</button>
      </div>
    }
  `,
  styleUrl: './admin.scss',
})
export class AdminAudit {
  private readonly api = inject(AdminApi);
  /** Bumped by the page after a CV view, to reload the first page. */
  readonly version = input(0);
  readonly page = signal<AdminPage<AuditEntry> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  private request = 0;

  constructor() {
    effect(() => {
      this.version();
      untracked(() => void this.load(0));
    });
  }

  async load(page: number): Promise<void> {
    const id = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.audit(page);
      if (id === this.request) this.page.set(result);
    } catch (error) {
      if (id === this.request) this.error.set(CvFlow.message(error, 'The audit log couldn’t be loaded.'));
    } finally {
      if (id === this.request) this.loading.set(false);
    }
  }

  pages(p: AdminPage<unknown>): number {
    return Math.max(1, Math.ceil(p.total / p.pageSize));
  }

  date(value: string): string {
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
