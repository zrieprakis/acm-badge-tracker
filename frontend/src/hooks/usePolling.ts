import { useEffect, useRef, useState } from 'react';

interface UsePollingResult<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refetch: () => void;
}

/** Fetches immediately, then re-fetches on a fixed interval for the lifetime of the component. */
export function usePolling<T>(fetchFn: () => Promise<T>, intervalMs: number): UsePollingResult<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  async function runFetch() {
    try {
      const result = await fetchFnRef.current();
      setData(result);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runFetch();
    const id = setInterval(() => void runFetch(), intervalMs);
    return () => clearInterval(id);
    // fetchFn is read via a ref so identity changes don't restart the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, error, loading, refetch: () => void runFetch() };
}
