import { Component } from '@angular/core';
import { CvExamplesSection } from './cv-examples-section';
import { DemoWindow } from './demo-window';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { HurdlesSection } from './hurdles-section';
import { ProblemSection } from './problem-section';
import { Showcase } from './showcase';
import { SmartPrompt } from '../../shared/smart-prompt';

/** The landing page. */
@Component({
  selector: 'app-home-page',
  imports: [CvExamplesSection, DemoWindow, Hero, HowItWorks, HurdlesSection, ProblemSection, Showcase, SmartPrompt],
  template: `
    <app-hero />
    <!-- Guests sign up first; the prompt and file wait in memory (not across a reload). -->
    <app-smart-prompt id="get-started" />
    <app-demo-window />
    <app-showcase />
    <app-problem-section />
    <app-hurdles-section />
    <app-how-it-works />
    <app-cv-examples-section />
  `,
  styles: `
    app-smart-prompt { margin: 0 auto 72px; padding-inline: var(--space-4); animation: fade-up .7s .2s cubic-bezier(.2, .7, .2, 1) both; }
    @media (max-width: 640px) { app-smart-prompt { margin-bottom: var(--space-7); } }
  `,
})
export class HomePage {}
