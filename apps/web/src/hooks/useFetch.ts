// hooks/useFetch.ts
import { useState, useEffect } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * A custom hook for handling data fetching with loading and error states
 * @param url The URL to fetch data from
 * @param options Optional fetch options
 * @returns Object containing loading state, data, and any errors
 */
export function useFetch<T>(url: string, options?: RequestInit): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Reset state when URL changes
    setState(prev => ({ ...prev, loading: true }));

    let isMounted = true;
    const abortController = new AbortController();

    async function fetchData() {
      try {
        const response = await fetch(url, {
          ...options,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted) {
          setState({
            data,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted && error instanceof Error && error.name !== 'AbortError') {
          setState({
            data: null,
            loading: false,
            error,
          });
        }
      }
    }

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [url, JSON.stringify(options)]);

  return state;
}

// Example usage:
/*
function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useFetch<User>(
    `/api/users/${userId}`
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No user found</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}
*/
