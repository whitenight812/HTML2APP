import { useState, useEffect, useCallback, useRef } from 'react';
import type { BuildStatus } from '../types';
import { getBuildStatus } from '../api/client';

export function useBuildTask(taskId: string | null) {
  const [status, setStatus] = useState<BuildStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    if (!taskId) return;
    try {
      const result = await getBuildStatus(taskId);
      setStatus(result);
      setError(null);

      if (result.status === 'done' || result.status === 'failed') {
        setLoading(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    setLoading(true);
    setStatus(null);
    setError(null);

    // Poll every 2 seconds
    poll(); // Immediate first poll
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId, poll]);

  return { status, loading, error };
}
