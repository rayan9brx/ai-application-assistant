import { Component, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  private readonly auth = inject(AuthService);
  /** Guests sign up; signed-in users go straight to their dashboard. */
  readonly ctaHref = computed(() => (this.auth.signedIn() ? '/dashboard' : '/signup'));
}
