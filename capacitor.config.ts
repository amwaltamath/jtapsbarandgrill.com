import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jtapsbarandgrill.app',
  appName: 'JTAPS Bar & Grill',
  webDir: 'dist',
  // Point to live site since we use SSR (Vercel)
  server: {
    url: 'https://jtapsbarandgrill.com',
    cleartext: false,
  },
  ios: {
    scheme: 'JTAPS',
    contentInset: 'automatic',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1a1a1a',
    },
  },
};

export default config;
