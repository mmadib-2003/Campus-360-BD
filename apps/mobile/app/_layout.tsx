// apps/mobile/app/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function RootMobileLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#10b981',
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
