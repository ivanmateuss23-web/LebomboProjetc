import { SM2State, Rating } from '../types';

/**
 * Calculates the next state of a card based on the user's rating using the SM-2 algorithm.
 */
export const calculateSM2 = (currentState: SM2State, rating: Rating): SM2State => {
  let { interval, repetition, efactor } = currentState;

  if (rating >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  } else {
    // Incorrect response (reset interval)
    repetition = 0;
    interval = 1;
  }

  // Update E-Factor
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  efactor = efactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  
  // EF cannot go below 1.3
  if (efactor < 1.3) {
    efactor = 1.3;
  }

  return {
    interval,
    repetition,
    efactor
  };
};

export const getNextReviewDate = (intervalDays: number): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day
  // Add days
  now.setDate(now.getDate() + intervalDays);
  return now.getTime();
};

export const isDue = (nextReviewDate: number): boolean => {
  const now = new Date().getTime();
  return nextReviewDate <= now;
};