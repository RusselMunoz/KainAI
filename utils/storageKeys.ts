// utils/storageKeys.ts
// Helpers for constructing consistent AsyncStorage keys

export const USER_STATS_KEY_PREFIX = '@kainai_user_stats';
export const LEGACY_USER_STATS_KEY = USER_STATS_KEY_PREFIX;

/**
 * Build the AsyncStorage key for a specific user's stats payload.
 * Falls back to the legacy global key when no user ID is provided.
 */
export const getUserStatsStorageKey = (userId?: string | null): string => {
  if (userId && userId.trim().length > 0) {
    return `${USER_STATS_KEY_PREFIX}:${userId}`;
  }
  return USER_STATS_KEY_PREFIX;
};
