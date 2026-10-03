import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yamaahmadi.ychat',
  appName: 'Ychat',
  webDir: 'public',
  server: {
    url: 'https://ychat.yamaahmadi.com',
    cleartext: false
  }
};

export default config;
