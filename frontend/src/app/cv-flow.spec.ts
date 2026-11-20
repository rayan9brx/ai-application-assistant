import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CvCheckPage } from './cv-check-page';
import { CvFlow, CvScore } from './cv-flow';

const CV =
  'Taylor Brooks\n\nExperience\n- Responsible for website updates\n\nSkills\nReact, TypeScript';

const SCORE: CvScore = {
  overall: 58,
  label: 'Needs improvement',
  categories: {
    content: 54,
    format: 82,
    optimization: 38,
    bestPractices: 63,
    applicationReady: 51,
  },
  fields: {
    name: { detected: true, detail: 'Detected' },
    contact: { detected: false, detail: 'No email or phone' },
    experience: { detected: true, detail: '1 position detected' },
    education: { detected: false, detail: '' },
    skills: { detected: true, detail: 'Detected' },
  },
  jobMatch: { matchPercent: 47, matchedKeywords: ['React'], missingKeywords: ['CI/CD'] },
  issues: [
    {
      section: 'Experience',
      problem: 'Duties, not results.',
      suggestion: 'Show impact.',
      severity: 'high',
    },
  ],
};

describe('CvFlow', () => {
  let flow: CvFlow;
  let http: HttpTestingController;
  const flush = () => new Promise((resolve) => setTimeout(resolve));
  const settle = async () => {
    await flush();
    await flush();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    flow = TestBed.inject(CvFlow);
    flow.reset();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('scores pasted text, applies an AI fix, tailors and re-scores', async () => {
    flow.jobDescription.set('React and CI/CD');
    const started = flow.startWithText(CV.replace(/\n/g, '\r\n')); // Windows clipboard line endings
    await settle();
    expect(flow.phase()).toBe('scoring');
    const score = http.expectOne('/api/cv/score');
    expect(score.request.body).toEqual({ cvText: CV, jobDescription: 'React and CI/CD' });
    score.flush(SCORE);
    await started;
    expect(flow.phase()).toBe('results');
    expect(flow.score()?.overall).toBe(58);

    const fixed = flow.fix(SCORE.issues[0]);
    await flush();
    http.expectOne('/api/cv/fix').flush({
      original: '- Responsible for website updates',
      replacement: '- Rebuilt 12 landing pages, cutting load time by [add result]',
      explanation: 'Shows impact.',
      needsUserInput: true,
      found: true,
    });
    const fix = await fixed;
    expect(flow.applyChange(fix.original, fix.replacement)).toBe(true);
    expect(flow.cvText()).toContain('Rebuilt 12 landing pages');
    expect(flow.stale()).toBe(true);
    expect(flow.applyChange('not in the CV', 'x')).toBe(false);

    const tailored = flow.tailor();
    await flush();
    http.expectOne('/api/cv/tailor').flush({
      changes: [
        {
          section: 'Skills',
          original: 'React, TypeScript',
          replacement: 'TypeScript, React',
          reason: 'Order.',
        },
      ],
      notes: ['Add CI/CD only if you have used it.'],
    });
    await tailored;
    expect(flow.tailoring()?.changes.length).toBe(1);

    const rescored = flow.rescore();
    await flush();
    expect(flow.previousOverall()).toBeNull(); // no comparison until the new score arrives
    http.expectOne('/api/cv/score').flush({ ...SCORE, overall: 71, label: 'Good' });
    await rescored;
    expect(flow.previousOverall()).toBe(58);
    expect(flow.score()?.overall).toBe(71);
    expect(flow.stale()).toBe(false);
  });

  it('shows the server message and returns to the input step when reading a file fails', async () => {
    const started = flow.startWithFile(new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    await settle();
    expect(flow.phase()).toBe('reading');
    http
      .expectOne('/api/cv/extract')
      .flush(
        { code: 'NO_TEXT', message: 'No readable text was found. It looks like a scanned image.' },
        { status: 422, statusText: 'Unprocessable' },
      );
    await started;
    expect(flow.phase()).toBe('input');
    expect(flow.error()).toContain('scanned image');
  });

  it('restores results after a refresh and forgets them on start over', () => {
    flow.cvText.set(CV);
    flow.score.set(SCORE);
    flow.setText(CV + '\nEdited');
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('applycraft.cv-check.v1')!).cvText).toContain('Edited');

    // A fresh app instance is what a page refresh gives us.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const reloaded = TestBed.inject(CvFlow);
    http = TestBed.inject(HttpTestingController);
    expect(reloaded.phase()).toBe('results');
    expect(reloaded.score()?.overall).toBe(58);
    expect(reloaded.cvText()).toContain('Edited');
    expect(reloaded.stale()).toBe(true);

    reloaded.jobDescription.set('Old job');
    reloaded.reset();
    TestBed.tick();
    expect(localStorage.getItem('applycraft.cv-check.v1')).toBeNull();
    expect(reloaded.jobDescription()).toBe(''); // a new check never reuses an old job description
  });

  it('ignores corrupt saved data', () => {
    localStorage.setItem('applycraft.cv-check.v1', '{"cvText": 5');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    expect(TestBed.inject(CvFlow).phase()).toBe('input');
  });

  it('keeps the results when a re-score fails', async () => {
    flow.score.set(SCORE);
    flow.cvText.set(CV);
    flow.phase.set('results');
    const rescored = flow.rescore();
    await settle();
    http
      .expectOne('/api/cv/score')
      .flush({ message: 'The AI service is busy right now.' }, { status: 503, statusText: 'Busy' });
    await rescored;
    expect(flow.phase()).toBe('results');
    expect(flow.error()).toContain('busy');
  });
});

describe('CvCheckPage', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('renders the real score with the shared report components', () => {
    const flow = TestBed.inject(CvFlow);
    flow.cvText.set(CV);
    flow.score.set(SCORE);
    flow.phase.set('results');
    const fixture = TestBed.createComponent(CvCheckPage);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const text = (selector: string) =>
      Array.from(root.querySelectorAll(selector), (el) =>
        el.textContent!.replace(/\s+/g, ' ').trim(),
      );

    expect(root.querySelector('app-score-gauge .value')?.textContent).toBe('58');
    expect(text('app-score-report .categories li').length).toBe(5);
    expect(text('li[app-parsed-field-row]')).toContain(
      '✗ Contact Info: Problem: No email or phone',
    );
    expect(text('li[app-skill-pill].missing')).toEqual(['✗ CI/CD']);
    expect(text('app-issue-card .problem')).toEqual(['Duties, not results.']);
    expect(root.querySelector<HTMLTextAreaElement>('#cv-editor')?.value).toBe(CV);
  });

  it('only enables scoring once there is a CV to score', () => {
    const fixture = TestBed.createComponent(CvCheckPage);
    TestBed.inject(CvFlow).reset();
    fixture.detectChanges();
    const button = () => fixture.nativeElement.querySelector('.score-button') as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    fixture.componentInstance.mode.set('paste');
    fixture.componentInstance.pasted.set(CV + '\n'.repeat(2) + 'More lines about my experience.');
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
  });
});
