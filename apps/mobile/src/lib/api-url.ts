import Constants from 'expo-constants';

const PRODUCTION_URL = 'https://api.tomia.fr';
const DEV_PORT = '3000';

export function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  if (!__DEV__) return PRODUCTION_URL;

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    console.warn(
      '[api-url] Constants.expoConfig.hostUri is undefined — falling back to localhost:3000. ' +
        'Set EXPO_PUBLIC_API_URL to override.',
    );
    return `http://localhost:${DEV_PORT}`;
  }

  const host = hostUri.split(':')[0];
  return `http://${host}:${DEV_PORT}`;
}
