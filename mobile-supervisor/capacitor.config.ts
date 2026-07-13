import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.annaibuilders.agb.supervisor',
  appName: 'AGB',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#f8f9fa',
    allowMixedContent: true,
  },
  plugins: {
    BarcodeScanner: {
      permissions: ['camera'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;