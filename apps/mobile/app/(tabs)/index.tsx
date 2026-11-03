// apps/mobile/app/(tabs)/index.tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function MobileHomeFeedScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#020617', padding: 16 }}>
      <View style={{ padding: 20, borderRadius: 16, backgroundColor: '#064e3b' }}>
        <Text style={{ color: '#ecfdf5', fontSize: 20, fontWeight: '800' }}>
          Campus360 BD — Verified Campus Feed
        </Text>
        <Text style={{ color: '#a7f3d0', fontSize: 13, marginTop: 6 }}>
          Multi-university RLS isolation • Academic Archive • Tracked Grievances • Live Events Map
        </Text>
      </View>
    </ScrollView>
  );
}
