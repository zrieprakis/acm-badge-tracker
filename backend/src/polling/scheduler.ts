import { env } from '../config/env.js';
import { runPollCycle } from './pollService.js';

let isCycleRunning = false;
let intervalHandle: NodeJS.Timeout | undefined;

async function tick(): Promise<void> {
  if (isCycleRunning) {
    console.warn('Skipping poll cycle: previous cycle is still running.');
    return;
  }

  isCycleRunning = true;
  try {
    const result = await runPollCycle();
    if (!result.success) {
      console.error('Poll cycle failed:', result.error);
    } else if (result.recordedEventCount > 0) {
      console.log(`Poll cycle: recorded ${result.recordedEventCount} new access event(s).`);
    }
  } finally {
    isCycleRunning = false;
  }
}

/** Starts the polling loop: runs once immediately, then on a fixed interval. */
export function startPollingScheduler(): void {
  if (intervalHandle) return;

  void tick();
  intervalHandle = setInterval(() => void tick(), env.POLL_INTERVAL_SECONDS * 1000);
}

export function stopPollingScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
}
