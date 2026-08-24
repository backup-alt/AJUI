import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.annaibuilders.agb.supervisor',
  appName: 'AGB',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#FFFFFF',
    allowMixedContent: true,
  },
  plugins: {
    BarcodeScanner: {
      permissions: ['camera'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;