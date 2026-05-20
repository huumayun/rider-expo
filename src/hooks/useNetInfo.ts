import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface UseNetInfoReturn {
  isConnected: boolean;
  isInternetReachable: boolean;
}

export function useNetInfo(): UseNetInfoReturn {
  const [state, setState] = useState<UseNetInfoReturn>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsub = NetInfo.addEventListener((netState: NetInfoState) => {
      setState({
        isConnected: netState.isConnected ?? true,
        isInternetReachable: netState.isInternetReachable ?? true,
      });
    });

    // Fetch current state immediately
    NetInfo.fetch().then((netState: NetInfoState) => {
      setState({
        isConnected: netState.isConnected ?? true,
        isInternetReachable: netState.isInternetReachable ?? true,
      });
    });

    return () => unsub();
  }, []);

  return state;
}
