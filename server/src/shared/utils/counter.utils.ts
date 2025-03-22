export function calculateAvailableCounter(
  counter: number,
  recordedCounter: number,
  currentCavityCount: number,
  isCounterPaused: boolean,
  pauseStartCounter: number | null,
): number {
  // ป้องกันค่าลบหรือ null
  counter = Math.max(0, counter || 0);
  recordedCounter = Math.max(0, recordedCounter || 0);
  currentCavityCount = Math.max(1, currentCavityCount || 1); // ค่าน้อยสุดควรเป็น 1

  let totalCounter: number;

  if (isCounterPaused && pauseStartCounter !== null) {
    // ใช้ pauseStartCounter เมื่อมีการหยุดนับงาน
    pauseStartCounter = Math.max(0, pauseStartCounter);
    totalCounter = pauseStartCounter * currentCavityCount;
  } else {
    // ใช้ counter ปัจจุบันในกรณีอื่นๆ
    totalCounter = counter * currentCavityCount;
  }

  // ป้องกันไม่ให้ผลลัพธ์เป็นค่าลบ
  return Math.max(0, totalCounter - recordedCounter);
}
