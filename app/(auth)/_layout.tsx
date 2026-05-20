import { Stack } from 'expo-router';
import { useApp } from '../../src/context/AppContext';

export default function AuthLayout() {
  const { T } = useApp();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: T.bg },
      }}
    />
  );
}
