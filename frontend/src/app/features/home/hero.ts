import { Component } from '@angular/core';
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
  readonly trust = ['Free to start', 'No credit card', 'Data stored in the EU'];
}
