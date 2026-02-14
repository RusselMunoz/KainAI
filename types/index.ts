// types/index.ts - TypeScript interfaces for Cheffy app

// ==================== USER TYPES ====================

export type UserLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master Chef';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  username: string;
  bio: string;
  dietary_preferences: string[];
  dietary_allergies: string[];
  cooking_skills: string[];
  level: UserLevel;
  xp: number;
  recipesCompleted: number;
  postsCreated: number;
  totalLikesReceived: number;
  totalSaves: number;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

// ==================== RECIPE TYPES ====================

export type RecipeStatus = 'Not Started' | 'In Progress' | 'Done';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type IngredientCategory = 'Protein' | 'Grain' | 'Vegetable' | 'Other' | 'Seasoning';
export type RecipeSource = 'ai-generated' | 'community' | 'imported';

export interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  category: IngredientCategory;
  notes?: string;
}

export interface Instruction {
  stepNumber: number;
  text: string;
  timeMinutes: number | null;
  tip?: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CookingProgress {
  currentStep: number;
  completedSteps: number[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  prepTime?: number;
  cookTime: number;
  totalTime?: number;
  servings: number;
  difficulty: Difficulty;
  calories: number;
  nutrition: Nutrition;
  tags: string[];
  category: string;
  status: RecipeStatus;
  cookingProgress: CookingProgress;
  userRating: number | null;
  source: RecipeSource;
  originalRecipeId: string | null;
  originalAuthorId: string | null;
  isPublic: boolean;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastCookedAt: Date | null;
}

// ==================== COMMUNITY TYPES ====================

export type PostType = 'recipe' | 'tip' | 'success' | 'question';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  authorLevel: UserLevel;
  type: PostType;
  title: string;
  content: string;
  recipeId: string | null;
  recipeTitle: string | null;
  recipeThumbnail: string | null;
  images: string[];
  tags: string[];
  rating: number;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  likedBy: string[];
  savedBy: string[];
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  likesCount: number;
  likedBy: string[];
  createdAt: Date;
}

export interface CommunityStats {
  totalMembers: number;
  totalRecipes: number;
  totalPosts: number;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T = any> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ChatResponse {
  ok: boolean;
  response?: string;
  recipe?: Recipe;
  recipeId?: string;
  model?: string;
  userConstraints?: Partial<User>;
  navigateTo?: string;
  needsConfirmation?: boolean;
  message?: string;
  error?: string;
}

export interface RecipeListResponse {
  ok: boolean;
  recipes: Recipe[];
  error?: string;
}

export interface PostListResponse {
  ok: boolean;
  posts: CommunityPost[];
  error?: string;
}

export interface LikeResponse {
  ok: boolean;
  liked: boolean;
  newCount: number;
  error?: string;
}

export interface SaveResponse {
  ok: boolean;
  saved: boolean;
  newCount: number;
  error?: string;
}

// ==================== COOKING MODE TYPES ====================

export interface CookingModeState {
  isActive: boolean;
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  completedSteps: Set<number>;
  startTime: Date | null;
  isPaused: boolean;
}

// ==================== NAVIGATION TYPES ====================

export type TabName = 'Chat' | 'Recipes' | 'Community' | 'Awards';

// ==================== MODULE STUBS ====================

declare module 'react-native-zoom-reanimated' {
  import { ReactNode } from 'react';
  import { ViewProps } from 'react-native';

  export type ZoomProps = ViewProps & {
    children?: ReactNode;
  };

  const Zoom: (props: ZoomProps) => JSX.Element;
  export default Zoom;
}

export interface TabSwitchContext {
  targetTab: TabName;
  recipeId?: string;
  showSharePrompt?: boolean;
}
