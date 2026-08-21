export const AI_SCORE_EPSILON = 1e-9

export const isMeaningfullyGreater = (
  candidate: number,
  current: number,
): boolean => candidate > current + AI_SCORE_EPSILON

export const isMeaningfullyLess = (
  candidate: number,
  current: number,
): boolean => candidate < current - AI_SCORE_EPSILON

export const areScoresEquivalent = (
  first: number,
  second: number,
): boolean => Math.abs(first - second) <= AI_SCORE_EPSILON
