export function calculateAvailableCounter(
  counter: number | null | undefined,
  recordedCounter: number | null | undefined,
  currentCavityCount: number | null | undefined,
  isCounterPaused: boolean,
  pauseStartCounter: number | null | undefined,
): number {
  // ใช้ nullish coalescing operator (??) และ Math.max เพื่อป้องกันค่า null และค่าลบ
  counter = Math.max(0, counter ?? 0);
  recordedCounter = Math.max(0, recordedCounter ?? 0);
  currentCavityCount = Math.max(1, currentCavityCount ?? 1); // ค่าน้อยสุดควรเป็น 1

  // เพิ่ม console.log เพื่อตรวจสอบค่า
  console.log('Inputs:', {
    counter,
    recordedCounter,
    currentCavityCount,
    isCounterPaused,
    pauseStartCounter,
  });

  let totalCounter: number;

  if (
    isCounterPaused &&
    pauseStartCounter !== null &&
    pauseStartCounter !== undefined
  ) {
    // ใช้ pauseStartCounter เมื่อมีการหยุดนับงาน
    pauseStartCounter = Math.max(0, pauseStartCounter);
    totalCounter = pauseStartCounter * currentCavityCount;
    console.log('Using pauseStartCounter:', {
      pauseStartCounter,
      totalCounter,
    });
  } else {
    // ใช้ counter ปัจจุบันในกรณีอื่นๆ
    totalCounter = counter * currentCavityCount;
    console.log('Using current counter:', { counter, totalCounter });
  }

  const availableCounter = Math.max(0, totalCounter - recordedCounter);
  console.log('Result:', { totalCounter, recordedCounter, availableCounter });

  // ป้องกันไม่ให้ผลลัพธ์เป็นค่าลบ
  return availableCounter;
}

export function setMachineCounter(
  totalPieces: number,
  cavityValue: number,
): { counter: number; recorded_counter: number } {
  totalPieces = Math.max(0, totalPieces || 0);
  cavityValue = Math.max(1, cavityValue || 1);
  const cycles = Math.floor(totalPieces / cavityValue);
  const remainder = totalPieces % cavityValue;

  return {
    counter: cycles,
    recorded_counter: remainder,
  };
}
