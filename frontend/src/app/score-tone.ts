/**
 * The one place that decides how a 0–100 score is coloured, everywhere in the app (ScoreRing,
 * ScoreGauge, progress bars, match values, history bars): 0–39 low (danger), 40–79 mid
 * (warning), 80–100 high (success). Style with [data-tone] or the variables below.
 */
export type ScoreTone = 'low' | 'mid' | 'high';

export const SCORE_MID = 40;
export const SCORE_HIGH = 80;

export function scoreTone(score: number): ScoreTone {
  return score < SCORE_MID ? 'low' : score < SCORE_HIGH ? 'mid' : 'high';
}

/** The CSS colour token for a tone. */
export const SCORE_TONE_COLOR: Record<ScoreTone, string> = {
  low: 'var(--score-low)',
  mid: 'var(--score-mid)',
  high: 'var(--score-high)',
};

export function scoreColor(score: number): string {
  return SCORE_TONE_COLOR[scoreTone(score)];
}
