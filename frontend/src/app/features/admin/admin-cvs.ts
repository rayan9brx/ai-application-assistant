import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { AdminApi, AdminCv, AdminCvContent, AdminPage } from './admin-api';
import { CvFlow } from '../../core/cv-flow';

/**
 * CVs tab: metadata only. Opening a CV's content asks for a reason, which the server stores in
 * the audit log before it returns the content. There is no export.
 */
@Component({
  selector: 'app-admin-cvs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <input class="search" type="search" placeholder="Search by owner email or title" aria-label="Search CVs"
        [value]="query()" (input)="search(value($event))" />
      @if (page(); as p) { <span class="muted">{{ p.total }} CVs</span> }
    </div>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="table-wrap">
      <table>
        <thead><tr><th>Owner</th><th>Title</th><th>Created</th><th class="num">Last score</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          @for (cv of page()?.items ?? []; track cv.id) {
            <tr>
              <td><span class="ellipsis" [title]="cv.ownerEmail ?? ''">{{ cv.ownerEmail ?? '–' }}</span></td>
              <td><span class="ellipsis" [title]="cv.title">{{ cv.title }}</span></td>
              <td>{{ date(cv.createdAt) }}</td>
              <td class="num">{{ cv.lastScore ?? '–' }}</td>
              <td class="num"><button type="button" class="small-button" (click)="ask(cv)">View CV</button></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="empty-row">{{ loading() ? 'Loading…' : 'No CVs found.' }}</td></tr>
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

    <dialog #dialog class="dialog" aria-labelledby="view-title" (close)="closed()">
      @if (viewed(); as v) {
        <div class="dialog-head">
          <div>
            <h2 id="view-title">{{ v.title }}</h2>
            <p class="muted">{{ v.ownerEmail }} · created {{ date(v.createdAt) }} · this view was logged</p>
          </div>
          <button type="button" class="small-button" (click)="dialog.close()">Close</button>
        </div>
        <pre class="cv-text">{{ v.content.text ?? '' }}</pre>
        @if (v.jobDescription) {
          <h3>Job description</h3>
          <pre class="cv-text job">{{ v.jobDescription }}</pre>
        }
      } @else if (target(); as cv) {
        <form (submit)="view($event)">
          <h2 id="view-title">View “{{ cv.title }}”</h2>
          <p class="muted">Only open a user’s CV for support or abuse handling. Your reason, your account and the
            time are saved in the audit log.</p>
          <label for="view-reason">Reason</label>
          <input id="view-reason" class="search reason" required minlength="3" maxlength="300"
            placeholder="e.g. support request #123" [value]="reason()" (input)="reason.set(value($event))" />
          @if (viewError()) { <p class="error" role="alert">{{ viewError() }}</p> }
          <div class="dialog-actions">
            <button type="button" class="small-button" (click)="dialog.close()">Cancel</button>
            <button type="submit" class="cta cta-small" [disabled]="busy() || reason().trim().length < 3">
              {{ busy() ? 'Opening…' : 'Log reason and view' }}</button>
          </div>
        </form>
      }
    </dialog>
  `,
  styleUrls: ['./admin.scss', './admin-cvs.scss'],
})
export class AdminCvs {
  private readonly api = inject(AdminApi);
  /** Tells the page a view was logged, so the audit tab reloads. */
  readonly logged = output<void>();
  readonly query = signal('');
  readonly page = signal<AdminPage<AdminCv> | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly target = signal<AdminCv | null>(null);
  readonly viewed = signal<AdminCvContent | null>(null);
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly viewError = signal('');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
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
      const result = await this.api.cvs(this.query().trim(), page);
      if (id === this.request) this.page.set(result);
    } catch (error) {
      if (id === this.request) this.error.set(CvFlow.message(error, 'CVs couldn’t be loaded.'));
    } finally {
      if (id === this.request) this.loading.set(false);
    }
  }

  ask(cv: AdminCv): void {
    this.target.set(cv);
    this.viewed.set(null);
    this.reason.set('');
    this.viewError.set('');
    this.dialog().nativeElement.showModal();
  }

  async view(event: Event): Promise<void> {
    event.preventDefault();
    const cv = this.target();
    const reason = this.reason().trim();
    if (!cv || this.busy() || reason.length < 3) return;
    this.busy.set(true);
    this.viewError.set('');
    try {
      this.viewed.set(await this.api.viewCv(cv.id, reason));
      this.logged.emit();
    } catch (error) {
      this.viewError.set(CvFlow.message(error, 'The CV couldn’t be opened.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** The content is dropped from memory as soon as the dialog closes. */
  closed(): void {
    this.viewed.set(null);
    this.target.set(null);
    this.reason.set('');
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
