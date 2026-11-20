import { TestBed } from '@angular/core/testing';
import { AtsPanel, AtsResult } from './ats-panel';
import { SAMPLE_ATS_CV, SAMPLE_ATS_RESULT } from './problem-section';

const render = async (result: AtsResult) => {
  const fixture = TestBed.createComponent(AtsPanel);
  fixture.componentRef.setInput('result', result);
  fixture.componentRef.setInput('cv', SAMPLE_ATS_CV);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};
const texts = (root: HTMLElement, selector: string) =>
  Array.from(root.querySelectorAll(selector), (el) => el.textContent!.replace(/\s+/g, ' ').trim());

describe('AtsPanel', () => {
  it('renders every value from the result data, with icons and text beside colour', async () => {
    // jsdom has no IntersectionObserver, so the panel shows its final state straight away.
    const root = await render(SAMPLE_ATS_RESULT);
    expect(texts(root, '.platforms li')).toEqual(SAMPLE_ATS_RESULT.platforms);
    expect(root.querySelector('.match-value')!.textContent).toContain('47%');
    expect(root.querySelector<HTMLElement>('.bar span')!.style.width).toBe('47%');
    expect(texts(root, '.status')).toEqual(['✗ Failed']);
    expect(root.querySelector('.filtered-badge')).not.toBeNull();
    expect(texts(root, '.fields li')).toEqual([
      '✓ Name: Detected',
      '✓ Contact Info: Detected',
      '✓ Experience: 3 positions detected',
      '✗ Skills: Problem: Parsed as body text',
    ]);
    expect(texts(root, 'li.missing')).toEqual(SAMPLE_ATS_RESULT.missingSkills.map((s) => `✗ ${s}`));
    expect(root.querySelector('.ats')!.classList).toContain('revealed');
  });

  it('switches to a passing state when the result passes', async () => {
    const root = await render({ ...SAMPLE_ATS_RESULT, passed: true, match: 82 });
    expect(texts(root, '.status')).toEqual(['✓ Passed']);
    expect(root.querySelector('.filtered-badge')).toBeNull();
    expect(root.querySelector('.match')!.getAttribute('data-tone')).toBe('high');
  });
});
