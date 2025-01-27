export function calculateAvailableCounter(
  counter: number,
  recordedCounter: number,
  currentCavityCount: number,
  isCounterPaused: boolean,
  pauseStartCounter: number | null,
): number {
  if (isCounterPaused && pauseStartCounter !== null) {
    return pauseStartCounter * currentCavityCount - recordedCounter;
  }
  return counter * currentCavityCount - recordedCounter;
}
