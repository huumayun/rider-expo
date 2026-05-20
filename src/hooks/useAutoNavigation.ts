import { useEffect, useRef } from 'react';

/**
 * useAutoNavigation - No-op stub.
 * Navigation is now handled in-app via MapViewDirections in RouteOverviewMap.
 * This hook is kept as a stub to avoid breaking existing imports.
 */
export function useAutoNavigation(destination: { lat: number; lng: number } | null) {
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!destination) {
      hasNavigatedRef.current = false;
      return;
    }
    // In-app navigation logic is now handled by MapViewDirections 
    // inside the Map component based on destination props.
  }, [destination]);
}
