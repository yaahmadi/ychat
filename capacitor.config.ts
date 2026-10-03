import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yamaahmadi.ychat',
  appName: 'Ychat',
  webDir: 'public',
  server: {
    url: 'https://ychat.yamaahmadi.com',
    cleartext: false
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#f5f8fc'
  }
};

export default config;
