import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * State that returns to `initial` whenever `resetKey` changes.
 *
 * This way branch expansion in the value tree follows the detail level, yet
 * stays manually controllable between its changes. The reset happens right in render
 * (the React "adjusting state during render" pattern), without an effect or an extra commit.
 */
export function useResettableState<T>(initial: T, resetKey: unknown): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setValue(initial);
  }
  return [value, setValue];
}
