import { useCallback, useRef, useState } from 'react';

// Blocks repeated taps on a save/sync button while its request is in flight.
// The ref is checked synchronously, so a second tap is ignored even before
// the `busy` state has re-rendered the button as disabled.
export default function useSubmitGuard() {
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<void> | void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
