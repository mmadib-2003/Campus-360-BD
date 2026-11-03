// apps/mobile/services/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function saveAnonymousCaseSecret(trackingCode: string, secret: string): Promise<void> {
  await SecureStore.setItemAsync(`anon_case_${trackingCode}`, secret, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function unlockAnonymousCaseSecret(trackingCode: string): Promise<string | null> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (hasHardware && isEnrolled) {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Anonymous Grievance Secret / গোপন ট্র্যাকিং কোড আনলক করুন',
      fallbackLabel: 'Use Passcode',
    });
    if (!auth.success) return null;
  }

  return SecureStore.getItemAsync(`anon_case_${trackingCode}`);
}
