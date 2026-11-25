import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mx.ubicarmen.app',
  appName: 'Ubicarmen',
  webDir: 'www',
  backgroundColor: '#f6f0fc',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  },
  android: {
    backgroundColor: '#f6f0fc'
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ['google.com']
    }
  }
};

export default config;
