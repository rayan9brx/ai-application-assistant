import { Component } from '@angular/core';
import { DemoWindow } from './demo-window';
import { FaqSection } from './faq-section';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';
import { ProblemSection } from './problem-section';
import { Reveal } from './reveal';
import { SectionHead } from './section-head';
import { TemplatesSection } from './templates-section';
import { WhySection } from './why-section';

/**
 * The landing page as one story: hero → demo → problem → how it works → why Rezumo →
 * templates → FAQ and final CTA. Every section shares the width, spacing and pill + headline.
 */
@Component({
  selector: 'app-home-page',
  imports: [DemoWindow, FaqSection, Hero, HowItWorks, ProblemSection, Reveal, SectionHead, TemplatesSection, WhySection],
  template: `
    <div class="home">
      <app-hero />
      <section aria-label="See it in action" appReveal>
        <app-section-head pill="See it in action" />
        <app-demo-window />
      </section>
      <app-problem-section />
      <app-how-it-works />
      <app-why-section />
      <app-templates-section />
      <app-faq-section />
    </div>
  `,
  styles: `
    .home { display: grid; gap: 120px; max-width: 1120px; margin-inline: auto; padding-bottom: 120px; }
    .home > * { min-width: 0; }
    @media (max-width: 640px) { .home { gap: 72px; padding-bottom: 72px; } }
  `,
})
export class HomePage {}
