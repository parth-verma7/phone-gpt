/** Build-time rollout switch. Shared provider credentials must never enter Expo public env. */
export const WEB_SEARCH_FEATURE_ENABLED = process.env.EXPO_PUBLIC_WEB_SEARCH_ENABLED === 'true';
export const WEB_SEARCH_API_URL = (process.env.EXPO_PUBLIC_WEB_SEARCH_API_URL ?? '').replace(/\/+$/, '');
export const WEB_SEARCH_MAX_CALLS_PER_TURN = 1;
export const WEB_SEARCH_RESULT_LIMIT = 3;

/** New installs default on; an explicit saved off choice always survives reload. */
export function restoreWebPreference(saved: string | null): boolean {
  return saved === null || saved === 'true';
}
