import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { AdminApi, AdminPage, AdminUser, countryName, flag } from './admin-api';
import { CvFlow } from './cv-flow';

/** Users tab: email search and pages of 25. */
@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <input class="search" type="search" placeholder="Search by email" aria-label="Search users by email"
        [value]="query()" (input)="search(value($event))" />
      @if (page(); as p) { <span class="muted">{{ p.total }} users</span> }
    </div>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Email</th><th>Signed up</th><th>Last login</th><th>Country</th><th class="num">CVs</th><th>Plan</th></tr>
        </thead>
        <tbody>
          @for (u of page()?.items ?? []; track u.id) {
            <tr>
              <td><span class="ellipsis" [title]="u.email ?? ''">{{ u.email ?? '–' }}</span>
                @if (u.role === 'admin') { <span class="badge admin">Admin</span> }</td>
              <td>{{ date(u.createdAt) }}</td>
              <td>{{ u.lastSignInAt ? date(u.lastSignInAt) : 'Never' }}</td>
              <td>@if (u.country) { <span aria-hidden="true">{{ flag(u.country) }}</span> {{ country(u.country) }} } @else { – }</td>
              <td class="num">{{ u.cvCount }}</td>
              <td><span class="badge">{{ u.plan }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty-row">{{ loading() ? 'Loading…' : 'No users found.' }}</td></tr>
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
export class AdminUsers {
  private readonly api = inject(AdminApi);
  readonly query = signal('');
  readonly page = signal<AdminPage<AdminUser> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly flag = flag;
  readonly country = countryName;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;

  constructor() {
    void this.load(0);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  search(q: string): void {
    this.query.set(q);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(0), 300);
  }

  async load(page: number): Promise<void> {
    const id = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.users(this.query().trim(), page);
      if (id === this.request) this.page.set(result);
    } catch (error) {
      if (id === this.request) this.error.set(CvFlow.message(error, 'Users couldn’t be loaded.'));
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

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
