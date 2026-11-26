import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { CheckIcon } from '../../shared/check-icon';
import { SmartPrompt } from '../../shared/smart-prompt';
import { Reveal } from './reveal';

@Component({
  selector: 'app-hero',
  imports: [CheckIcon, SmartPrompt],
  hostDirectives: [Reveal],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  /** The free ATS check, through sign-up for guests. */
  readonly checkHref = inject(AuthService).startHref;
  readonly trust = ['Free to start', 'No credit card', 'Data stored in the EU'];
}
