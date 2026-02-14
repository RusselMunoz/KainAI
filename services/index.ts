// services/index.ts - Central export for all Firebase services
// Import from here for cleaner imports: import { userService, recipeService } from '../services';

// Firebase configuration
export { default as firebase, isDemoMode, DEMO_USER_ID, generateId, serverTimestamp, timestampToDate } from '../config/firebase';

// User operations
export { default as userService } from './userService';
export type { UserData } from './userService';

// Recipe operations (Firebase version)
export { default as recipeService } from './recipeService';
export type { RecipeData } from './recipeService';

// Community operations (Firebase version)
export { default as communityService } from './communityService';
export type { CommunityPostData, CommentData } from './communityService';

// Achievement operations
export { default as achievementService } from './achievementService';
export type { 
  AchievementType, 
  AchievementDefinition, 
  AchievementProgress, 
  WeeklyGoal, 
  Achievements 
} from './achievementService';

// Stats operations
export { default as statsService, XP_REWARDS, POINT_REWARDS } from './statsService';
export type { UserStats, LevelInfo, XPAwardResult, XPLogEntry, LevelThreshold } from './statsService';

// Legacy services (for backward compatibility)
// These will be deprecated once Firebase integration is complete
export { default as legacyRecipeService } from './recipe.service';
export { default as legacyCommunityService } from './community.service';
export { default as legacyUserStatsService } from './user-stats.service';
