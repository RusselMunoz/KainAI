# Cheffy Firestore Database Schema

## Collections Overview

```
├── users/
│   └── {userId}/
│       ├── profile data
│       └── recipes/ (subcollection)
│           └── {recipeId}/
│               └── instruction_progress/ (subcollection)
├── recipes/ (global collection for search/discovery)
│   └── {recipeId}/
└── community_posts/
    └── {postId}/
        └── comments/ (subcollection)
```

---

## 1. Users Collection (`users`)

Stores user profile and preferences.

### Document Structure: `users/{userId}`

```typescript
interface User {
  // Basic Info
  uid: string;                      // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL: string | null;
  
  // Profile
  username: string;                 // Unique display name
  bio: string;
  
  // Preferences (from onboarding)
  dietary_preferences: string[];    // ['vegetarian', 'low-carb', etc.]
  dietary_allergies: string[];      // ['peanuts', 'shellfish', etc.]
  cooking_skills: string[];         // ['beginner', 'intermediate', 'advanced']
  
  // Gamification
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master Chef';
  xp: number;
  recipesCompleted: number;         // Count of recipes marked "Done"
  postsCreated: number;             // Count of community posts
  
  // Stats
  totalLikesReceived: number;
  totalSaves: number;
  
  // Metadata
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: boolean;
}
```

### Level Progression Rules
| Level          | Recipes Completed |
|----------------|-------------------|
| Beginner       | 0-4               |
| Intermediate   | 5-14              |
| Advanced       | 15-29             |
| Expert         | 30-49             |
| Master Chef    | 50+               |

---

## 2. Recipes Collection (`users/{userId}/recipes`)

User's personal recipe archive. Also mirrored in global `recipes` collection for discovery.

### Document Structure: `recipes/{recipeId}`

```typescript
interface Recipe {
  // Identifiers
  id: string;
  userId: string;                   // Owner's UID
  
  // Recipe Content
  title: string;
  description: string;
  
  // Ingredients (categorized)
  ingredients: Ingredient[];
  
  // Instructions (step-by-step)
  instructions: Instruction[];
  
  // Metadata
  cookTime: number;                 // In minutes
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  calories: number;
  
  // Macros
  nutrition: {
    calories: number;
    protein: number;                // In grams
    carbs: number;                  // In grams
    fat: number;                    // In grams
  };
  
  // Tags & Categories
  tags: string[];                   // ['One-Pot', 'Chicken', 'Quick', etc.]
  category: string;                 // 'Main Course', 'Dessert', etc.
  
  // Status Tracking
  status: 'Not Started' | 'In Progress' | 'Done';
  cookingProgress: {
    currentStep: number;            // 0-indexed, -1 if not started
    completedSteps: number[];       // Array of completed step indices
    startedAt: Timestamp | null;
    completedAt: Timestamp | null;
  };
  
  // Ratings
  userRating: number | null;        // User's own rating (1-5)
  
  // Source
  source: 'ai-generated' | 'community' | 'imported';
  originalRecipeId: string | null;  // If copied from community
  originalAuthorId: string | null;
  
  // Sharing
  isPublic: boolean;
  shareCount: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastCookedAt: Timestamp | null;
}

interface Ingredient {
  name: string;
  amount: string;                   // "2", "1/2", etc.
  unit: string;                     // "cups", "tbsp", "g", etc.
  category: 'Protein' | 'Grain' | 'Vegetable' | 'Other' | 'Seasoning';
  notes?: string;                   // "diced", "room temperature", etc.
}

interface Instruction {
  stepNumber: number;               // 1-indexed
  text: string;
  timeMinutes: number | null;       // Duration for this step
  tip?: string;                     // Optional cooking tip
}
```

---

## 3. Community Posts Collection (`community_posts`)

Social feed posts shared by users.

### Document Structure: `community_posts/{postId}`

```typescript
interface CommunityPost {
  // Identifiers
  id: string;
  
  // Author Info (denormalized for fast reads)
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  authorLevel: string;              // 'Beginner', 'Intermediate', etc.
  
  // Content
  type: 'recipe' | 'tip' | 'success' | 'question';
  title: string;
  content: string;                  // Post body/excerpt
  
  // Recipe Reference (if type is 'recipe' or 'success')
  recipeId: string | null;
  recipeTitle: string | null;
  recipeThumbnail: string | null;
  
  // Media
  images: string[];                 // Array of image URLs
  
  // Tags
  tags: string[];                   // ['#Seafood', '#Quick', etc.]
  
  // Engagement
  rating: number;                   // Author's rating of the dish (1-5)
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  
  // Users who engaged (for preventing duplicate actions)
  likedBy: string[];                // Array of user IDs
  savedBy: string[];                // Array of user IDs
  
  // Visibility
  isTrending: boolean;
  isFeatured: boolean;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Comments Subcollection: `community_posts/{postId}/comments/{commentId}`

```typescript
interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  likesCount: number;
  likedBy: string[];
  createdAt: Timestamp;
}
```

---

## 4. Indexes Required

### Composite Indexes

1. **User Recipes by Status**
   - Collection: `users/{userId}/recipes`
   - Fields: `status` (ASC), `createdAt` (DESC)

2. **Community Posts Feed**
   - Collection: `community_posts`
   - Fields: `createdAt` (DESC)

3. **Community Posts by Type**
   - Collection: `community_posts`
   - Fields: `type` (ASC), `createdAt` (DESC)

4. **Trending Posts**
   - Collection: `community_posts`
   - Fields: `isTrending` (ASC), `likesCount` (DESC)

---

## 5. Security Rules (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // User's recipes subcollection
      match /recipes/{recipeId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Global recipes (for discovery)
    match /recipes/{recipeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Community posts
    match /community_posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.authorId;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.authorId;
      
      // Comments
      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.auth.uid == request.resource.data.authorId;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
      }
    }
  }
}
```

---

## 6. Data Flow Examples

### Recipe Generation Flow
1. User sends ingredients to AI via `/api/chat`
2. AI generates structured recipe
3. Recipe saved to `users/{userId}/recipes/{newRecipeId}`
4. If user makes it public, also saved to `recipes/{recipeId}`
5. Navigate user to Recipes tab

### Cooking Mode Flow
1. User enters recipe detail, taps "Start Cooking Mode"
2. Update `cookingProgress.startedAt`
3. As steps complete, update `cookingProgress.completedSteps[]`
4. On final step complete, show "Finished" button
5. Mark recipe `status: 'Done'`, update `completedAt`
6. Increment user's `recipesCompleted` and `xp`
7. Prompt to share to community

### Community Post Flow
1. User chooses to share after completing recipe
2. Create `community_posts/{newPostId}` with recipe reference
3. Increment user's `postsCreated`
4. Other users can like/save/comment
5. "Save to Archive" copies recipe to their `users/{theirId}/recipes/`
