import { useState, useEffect, useCallback } from 'react';

/**
 * Custom Hook: useSamvaadEngine
 * Connects React UI components directly to the backend Samvaad AI Semantic Engine instance.
 */
export function useSamvaadEngine(initialSessionId = 'S203') {
  const [engineStatus, setEngineStatus] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [architectureDetails, setArchitectureDetails] = useState(null);
  const [lastPipelineResult, setLastPipelineResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getApiUrl = (endpoint) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${base.replace(/\/$/, '')}/api/engine${endpoint}`;
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/status'));
      const data = await res.json();
      if (data.ok) {
        setEngineStatus(data);
      }
    } catch (err) {
      console.warn('Engine status offline, using fallback state:', err.message);
    }
  }, []);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/timeline?limit=15'));
      const data = await res.json();
      if (data.ok) {
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.warn('Engine timeline fetch fallback:', err.message);
    }
  }, []);

  const fetchArchitectureDetails = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/architecture-overview'));
      const data = await res.json();
      if (data.ok) {
        setArchitectureDetails(data.architectureDetails);
      }
    } catch (err) {
      console.warn('Architecture overview fetch fallback:', err.message);
    }
  }, []);

  const simulateMultimodalInput = async (actor, modality, payload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor, modality, payload })
      });
      const data = await res.json();
      if (data.ok) {
        setLastPipelineResult(data.result);
        await fetchStatus();
        await fetchTimeline();
        return data.result;
      } else {
        throw new Error(data.error || 'Pipeline execution failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchTimeline();
    fetchArchitectureDetails();
    const interval = setInterval(() => {
      fetchStatus();
      fetchTimeline();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTimeline, fetchArchitectureDetails]);

  return {
    engineStatus,
    timeline,
    architectureDetails,
    lastPipelineResult,
    loading,
    error,
    simulateMultimodalInput,
    refreshStatus: fetchStatus
  };
}
