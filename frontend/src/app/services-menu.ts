import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MENU_COLUMNS, TOOLS_HREF, itemsIn } from './menu-config';
import { MenuItem } from './menu-item';

export type ServicesMenuVariant = 'dropdown' | 'accordion';

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 200;
const PANEL_WIDTH = 720;
const VIEWPORT_GUTTER = 16;
let nextId = 0;

/**
 * "Services" disclosure menu. As a dropdown it opens on mouse hover (with delays) or on
 * click/Enter/Space; as an accordion (mobile menu) it only toggles on click.
 */
@Component({
  selector: 'app-services-menu',
  imports: [MenuItem],
  templateUrl: './services-menu.html',
  styleUrl: './services-menu.scss',
  host: {
    '[class.accordion]': "variant() === 'accordion'",
    '(pointerenter)': 'hover($event, true)',
    '(pointerleave)': 'hover($event, false)',
    '(focusout)': 'focusLeft($event)',
    '(keydown.escape)': 'escape($event)',
    '(document:click)': 'outsideClick($event)',
  },
})
export class ServicesMenu {
  readonly variant = input<ServicesMenuVariant>('dropdown');
  /** Emitted after one of the links is followed. */
  readonly navigate = output<void>();

  readonly open = signal(false);
  readonly offset = signal(0);
  readonly width = signal(PANEL_WIDTH);
  readonly columns = MENU_COLUMNS.map((column) => ({ ...column, items: itemsIn(column.id) }));
  readonly toolsHref = TOOLS_HREF;
  readonly panelId = `services-menu-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private timer?: ReturnType<typeof setTimeout>;
  private openedByHover = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** A click right after hover opened the menu keeps it open instead of closing it. */
  toggle(): void {
    if (this.open() && this.openedByHover) {
      this.openedByHover = false;
      return;
    }
    this.setOpen(!this.open());
  }

  hover(event: PointerEvent, entering: boolean): void {
    if (this.variant() !== 'dropdown' || event.pointerType !== 'mouse') return;
    clearTimeout(this.timer);
    if (entering === this.open()) return;
    this.timer = setTimeout(
      () => {
        this.setOpen(entering);
        this.openedByHover = entering;
      },
      entering ? OPEN_DELAY_MS : CLOSE_DELAY_MS,
    );
  }

  triggerKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.setOpen(true);
    afterNextRender(() => this.focusLink(event.key === 'ArrowDown' ? 0 : -1), {
      injector: this.injector,
    });
  }

  panelKey(event: KeyboardEvent): void {
    const links = this.links();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const moves: Record<string, number> = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: links.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    this.focusLink((moves[event.key] + links.length) % links.length);
  }

  linkClicked(event: MouseEvent): void {
    if (!(event.target as Element).closest('a')) return;
    this.setOpen(false);
    this.navigate.emit();
  }

  escape(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.setOpen(false);
    this.trigger().nativeElement.focus();
  }

  /** Close when Tab moves focus somewhere outside the menu. */
  focusLeft(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.variant() === 'dropdown' && next && !this.host.nativeElement.contains(next)) {
      this.setOpen(false);
    }
  }

  outsideClick(event: MouseEvent): void {
    if (this.variant() !== 'dropdown' || !this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.setOpen(false);
  }

  private setOpen(open: boolean): void {
    clearTimeout(this.timer);
    if (!open) this.openedByHover = false;
    if (open && this.variant() === 'dropdown') this.position();
    this.open.set(open);
  }

  /** Keep the panel left-aligned with "Services" but inside the viewport. */
  private position(): void {
    const left = this.trigger().nativeElement.getBoundingClientRect().left;
    const width = Math.min(PANEL_WIDTH, innerWidth - VIEWPORT_GUTTER * 2);
    this.width.set(width);
    this.offset.set(Math.min(0, innerWidth - VIEWPORT_GUTTER - left - width));
  }

  private links(): HTMLAnchorElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll('a'));
  }

  private focusLink(index: number): void {
    const links = this.links();
    links.at(index)?.focus();
  }
}
