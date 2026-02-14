# Firebase Manual Setup Guide for KainAI

This guide provides step-by-step instructions for setting up Firebase Console to work with the KainAI app. Follow these instructions to configure Firestore, Authentication, and Security Rules that match what the app code expects.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Firebase Project](#step-1-create-firebase-project)
4. [Step 2: Set Up Authentication](#step-2-set-up-authentication)
5. [Step 3: Create Firestore Database](#step-3-create-firestore-database)
6. [Step 4: Collection Structures](#step-4-collection-structures)
7. [Step 5: Create Indexes](#step-5-create-indexes)
8. [Step 6: Security Rules](#step-6-security-rules)
9. [Step 7: Environment Variables](#step-7-environment-variables)
10. [Step 8: Android Configuration](#step-8-android-configuration)
11. [Step 9: iOS Configuration](#step-9-ios-configuration)
12. [Testing Your Setup](#testing-your-setup)

---

## Overview

KainAI uses Firebase for:
- **Authentication**: Google Sign-In for user authentication
- **Firestore**: Real-time database for users, recipes, community posts, achievements, and stats
- **Storage** (optional): For storing recipe images and user profile pictures

The app includes a **Demo Mode** that works without Firebase, using AsyncStorage locally. Demo mode activates when:
- User ID is `demo-user-id`
- User ID starts with `demo-user-`
- No Firebase configuration is present

---

## Prerequisites

Before starting, ensure you have:
- A Google account
- Access to [Firebase Console](https://console.firebase.google.com)
- The KainAI app codebase ready

---

## Step 1: Create Firebase Project

### 1.1 Create New Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter project name: `KainAI` (or your preferred name)
4. Choose whether to enable Google Analytics (recommended for production)
5. Click **"Create project"**

### 1.2 Note Your Project ID
After creation, note your project ID (visible in Project Settings > General). You'll need this for configuration files.

---

## Step 2: Set Up Authentication

### 2.1 Enable Google Sign-In
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click **Google** in the provider list
3. Toggle **Enable**
4. Set your project support email
5. Click **Save**

### 2.2 Get Web Client ID
1. Still in Authentication settings, under Google provider
2. Copy the **Web client ID** (e.g., `123456789-abcdefg.apps.googleusercontent.com`)
3. You'll need this for `google-signin.ts` configuration

### 2.3 Configure SHA Fingerprints (Android)
1. Go to **Project Settings** > **Your apps**
2. Add your SHA-1 and SHA-256 fingerprints:
   ```bash
   # Get debug certificate fingerprint
   cd android && ./gradlew signingReport
   ```
3. Copy the SHA-1 and SHA-256 from the output and add them

---

## Step 3: Create Firestore Database

### 3.1 Create Database
1. In Firebase Console, go to **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** for development (we'll add security rules later)
4. Select your preferred location (choose closest to your users)
5. Click **Enable**

### 3.2 Enable Required APIs
The following Firebase services should be enabled:
- Firestore
- Authentication
- Storage (optional, for images)

---

## Step 4: Collection Structures

Create the following collections in Firestore. The structure must match exactly what the service code expects.

### 4.1 Collection: `users`

Stores user profiles, created by `userService.createUser()`.

**Document ID**: User's Firebase Auth UID

```typescript
// Document: users/{userId}
{
  // Required fields (set on creation)
  uid: string,                      // Firebase Auth UID (same as document ID)
  email: string,                    // User's email address
  displayName: string,              // User's display name
  photoURL: string | null,          // Profile picture URL
  
  // Profile fields
  username: string,                 // Unique username (auto-generated from displayName)
  bio: string,                      // User biography
  
  // Dietary preferences (from onboarding)
  dietary_preferences: string[],    // e.g., ["vegetarian", "low-carb"]
  dietary_allergies: string[],      // e.g., ["peanuts", "shellfish"]
  dietary_custom: string,           // Custom dietary text
  allergy_custom: string,           // Custom allergy text
  cooking_skills: string[],         // e.g., ["beginner"]
  
  // Gamification
  level: string,                    // "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Master Chef"
  xp: number,                       // Total XP earned
  recipesCompleted: number,         // Count of completed recipes
  postsCreated: number,             // Count of community posts created
  
  // Stats
  totalLikesReceived: number,       // Total likes on user's posts
  totalSaves: number,               // Total saves on user's posts
  
  // Metadata
  created_at: Timestamp,            // Account creation date
  updated_at: Timestamp,            // Last update date
  is_active: boolean                // Account active status
}
```

**Example Document:**
```json
{
  "uid": "abc123xyz",
  "email": "chef@example.com",
  "displayName": "John Chef",
  "photoURL": "https://example.com/photo.jpg",
  "username": "john_chef",
  "bio": "I love cooking Filipino dishes!",
  "dietary_preferences": ["vegetarian"],
  "dietary_allergies": ["peanuts"],
  "dietary_custom": "",
  "allergy_custom": "",
  "cooking_skills": ["beginner"],
  "level": "Beginner",
  "xp": 0,
  "recipesCompleted": 0,
  "postsCreated": 0,
  "totalLikesReceived": 0,
  "totalSaves": 0,
  "created_at": "2026-02-14T00:00:00.000Z",
  "updated_at": "2026-02-14T00:00:00.000Z",
  "is_active": true
}
```

---

### 4.2 Collection: `recipes`

Stores user recipes, created by `recipeService.createRecipe()`.

**Document ID**: Auto-generated 20-character string

```typescript
// Document: recipes/{recipeId}
{
  // Identifiers
  id: string,                       // Same as document ID
  userId: string,                   // Owner's UID
  
  // Recipe content
  title: string,                    // Recipe title
  description: string,              // Recipe description
  
  // Ingredients array
  ingredients: [
    {
      name: string,                 // Ingredient name
      amount: string,               // e.g., "2", "1/2"
      unit: string,                 // e.g., "cups", "tbsp"
      category: string,             // "Protein" | "Grain" | "Vegetable" | "Other" | "Seasoning"
      notes?: string                // Optional notes (e.g., "diced")
    }
  ],
  
  // Instructions array
  instructions: [
    {
      stepNumber: number,           // 1-indexed step number
      text: string,                 // Instruction text
      timeMinutes: number | null,   // Duration for this step
      tip?: string                  // Optional cooking tip
    }
  ],
  
  // Timing
  prepTime: number,                 // Preparation time in minutes
  cookTime: number,                 // Cooking time in minutes
  totalTime: number,                // Total time in minutes
  
  // Recipe metadata
  servings: number,                 // Number of servings
  difficulty: string,               // "Easy" | "Medium" | "Hard"
  calories: number,                 // Total calories
  
  // Nutrition
  nutrition: {
    calories: number,
    protein: number,                // In grams
    carbs: number,                  // In grams
    fat: number                     // In grams
  },
  
  // Tags and category
  tags: string[],                   // e.g., ["One-Pot", "Chicken", "Quick"]
  category: string,                 // e.g., "Main Course", "Dessert"
  
  // Progress tracking
  status: string,                   // "Not Started" | "In Progress" | "Done"
  cookingProgress: {
    currentStep: number,            // 0-indexed current step
    completedSteps: number[],       // Array of completed step indices
    startedAt: Timestamp | null,    // When cooking started
    completedAt: Timestamp | null   // When cooking finished
  },
  
  // Rating
  userRating: number | null,        // User's rating (1-5)
  
  // Source tracking
  source: string,                   // "ai-generated" | "community" | "imported"
  originalRecipeId: string | null,  // If copied from community
  originalAuthorId: string | null,  // Original author's UID
  
  // Sharing
  isPublic: boolean,                // Whether recipe is shared publicly
  shareCount: number,               // Number of times shared
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastCookedAt: Timestamp | null
}
```

**Example Document:**
```json
{
  "id": "abc123recipeXYZ",
  "userId": "user123",
  "title": "Chicken Adobo",
  "description": "Classic Filipino chicken dish",
  "ingredients": [
    {
      "name": "Chicken thighs",
      "amount": "1",
      "unit": "kg",
      "category": "Protein"
    },
    {
      "name": "Soy Sauce",
      "amount": "1/2",
      "unit": "cup",
      "category": "Seasoning"
    }
  ],
  "instructions": [
    {
      "stepNumber": 1,
      "text": "Marinate chicken in soy sauce and vinegar for 30 minutes",
      "timeMinutes": 30
    }
  ],
  "prepTime": 15,
  "cookTime": 45,
  "totalTime": 60,
  "servings": 4,
  "difficulty": "Easy",
  "calories": 350,
  "nutrition": {
    "calories": 350,
    "protein": 28,
    "carbs": 12,
    "fat": 18
  },
  "tags": ["Filipino", "Chicken", "One-Pot"],
  "category": "Main Course",
  "status": "Not Started",
  "cookingProgress": {
    "currentStep": 0,
    "completedSteps": [],
    "startedAt": null,
    "completedAt": null
  },
  "userRating": null,
  "source": "ai-generated",
  "originalRecipeId": null,
  "originalAuthorId": null,
  "isPublic": false,
  "shareCount": 0,
  "createdAt": "2026-02-14T00:00:00.000Z",
  "updatedAt": "2026-02-14T00:00:00.000Z",
  "lastCookedAt": null
}
```

---

### 4.3 Collection: `community_posts`

Stores community posts, created by `communityService.createCommunityPost()`.

**Document ID**: Auto-generated 20-character string

```typescript
// Document: community_posts/{postId}
{
  // Identifiers
  id: string,                       // Same as document ID
  
  // Author info (denormalized for fast reads)
  authorId: string,                 // Author's UID
  authorName: string,               // Author's display name
  authorPhotoURL: string | null,    // Author's profile picture
  authorLevel: string,              // Author's level at time of post
  
  // Content
  type: string,                     // "recipe" | "tip" | "success" | "question"
  title: string,                    // Post title
  content: string,                  // Post body text
  
  // Recipe reference (if type is 'recipe' or 'success')
  recipeId: string | null,          // Referenced recipe ID
  recipeTitle: string | null,       // Recipe title
  recipeThumbnail: string | null,   // Recipe thumbnail URL
  
  // Media
  images: string[],                 // Array of image URLs
  
  // Tags
  tags: string[],                   // e.g., ["#Seafood", "#Quick"]
  
  // Rating (for success posts)
  rating: number,                   // Author's rating (1-5) or 0
  
  // Engagement counts
  likesCount: number,
  commentsCount: number,
  savesCount: number,
  
  // Users who engaged
  likedBy: string[],                // Array of user IDs who liked
  savedBy: string[],                // Array of user IDs who saved
  
  // Visibility flags
  isTrending: boolean,
  isFeatured: boolean,
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4.3.1 Subcollection: `community_posts/{postId}/comments`

**Document ID**: Auto-generated 20-character string

```typescript
// Document: community_posts/{postId}/comments/{commentId}
{
  id: string,                       // Same as document ID
  authorId: string,                 // Comment author's UID
  authorName: string,               // Author's display name  
  authorPhotoURL: string | null,    // Author's profile picture
  content: string,                  // Comment text
  likesCount: number,               // Number of likes on comment
  likedBy: string[],                // User IDs who liked
  createdAt: Timestamp
}
```

---

### 4.4 Collection: `achievements`

Stores user achievement progress, managed by `achievementService`.

**Document ID**: User's Firebase Auth UID

```typescript
// Document: achievements/{userId}
{
  // Achievement progress array
  progress: [
    {
      type: string,                 // Achievement type identifier
      currentValue: number,         // Current progress value
      unlockedAt: Timestamp | null, // When achievement was unlocked
      claimed: boolean              // Whether rewards were claimed
    }
  ],
  
  // Unlocked achievement IDs
  unlockedAchievements: string[],   // e.g., ["first_recipe", "five_recipes"]
  
  // Streak tracking
  cookingStreak: number,            // Current consecutive days
  lastCookDate: string | null,      // ISO date string of last cook
  
  // Weekly goals
  weeklyGoals: [
    {
      id: string,                   // Goal identifier
      type: string,                 // "recipesCooked" | "newIngredientsTried" | "creationsShared"
      name: string,                 // Display name
      description: string,          // Goal description
      target: number,               // Target value
      current: number,              // Current progress
      completed: boolean,           // Whether goal is completed
      xpReward: number,             // XP reward on completion
      pointsReward: number          // Points reward on completion
    }
  ],
  
  lastWeeklyReset: string | null    // ISO date of last weekly reset
}
```

**Achievement Types:**
| Type | Description |
|------|-------------|
| `recipes_completed` | Total recipes completed |
| `recipes_shared` | Recipes shared to community |
| `comments_made` | Comments on posts |
| `likes_received` | Total likes received |
| `unique_ingredients` | Unique ingredients tried |
| `cooking_streak` | Consecutive cooking days |
| `posts_created` | Community posts created |

---

### 4.5 Collection: `user_stats`

Stores detailed user statistics, managed by `statsService`.

**Document ID**: User's Firebase Auth UID

```typescript
// Document: user_stats/{userId}
{
  xp: number,                       // Total XP
  level: string,                    // Current level
  rewardPoints: number,             // Spendable reward points
  recipesCompleted: number,
  recipesShared: number,
  totalIngredientsUsed: number,
  uniqueIngredients: string[],      // List of unique ingredients used
  achievementsCompleted: string[],  // Completed achievement IDs
  currentStreak: number,
  longestStreak: number,
  lastCookDate: string | null,      // ISO date string
  communityPoints: number,
  totalLikesReceived: number,
  totalCommentsReceived: number
}
```

---

## Step 5: Create Indexes

Create the following composite indexes in Firestore to support the queries made by the service code.

### How to Create Indexes
1. Go to **Firestore Database** > **Indexes**
2. Click **"Create Index"**
3. Enter the collection and fields

### Required Indexes

#### 5.1 Recipes by User and Status
```
Collection: recipes
Fields:
  - userId (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

#### 5.2 Recipes by User and Creation Date
```
Collection: recipes
Fields:
  - userId (Ascending)
  - createdAt (Descending)
```

#### 5.3 Community Posts Feed (by creation date)
```
Collection: community_posts
Fields:
  - createdAt (Descending)
```

#### 5.4 Community Posts by Type
```
Collection: community_posts
Fields:
  - type (Ascending)
  - createdAt (Descending)
```

#### 5.5 Trending Posts
```
Collection: community_posts
Fields:
  - isTrending (Ascending)
  - likesCount (Descending)
```

#### 5.6 Featured Posts
```
Collection: community_posts
Fields:
  - isFeatured (Ascending)
  - createdAt (Descending)
```

#### 5.7 Posts by Author
```
Collection: community_posts
Fields:
  - authorId (Ascending)
  - createdAt (Descending)
```

#### 5.8 Comments by Creation Date
```
Collection Group: comments
Fields:
  - createdAt (Descending)
```

---

## Step 6: Security Rules

Deploy the following security rules to protect your Firestore database. These rules ensure:
- Users can only modify their own data
- Posts can be read by any authenticated user
- Comments can be created by any authenticated user but only deleted by the author

### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user owns the resource
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      // Anyone authenticated can read user profiles
      allow read: if isAuthenticated();
      
      // Only the owner can write to their profile
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if isOwner(userId);
    }
    
    // Recipes collection
    match /recipes/{recipeId} {
      // Authenticated users can read all recipes
      allow read: if isAuthenticated();
      
      // Only owner can create, update, delete
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.userId;
      allow update: if isAuthenticated() && request.auth.uid == resource.data.userId;
      allow delete: if isAuthenticated() && request.auth.uid == resource.data.userId;
    }
    
    // Community posts collection
    match /community_posts/{postId} {
      // Anyone authenticated can read posts
      allow read: if isAuthenticated();
      
      // Authenticated users can create posts (must be the author)
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.authorId;
      
      // Updates allowed for:
      // - Author: can update any field
      // - Others: can only update likedBy, savedBy, likesCount, savesCount (for likes/saves)
      allow update: if isAuthenticated() && (
        request.auth.uid == resource.data.authorId ||
        (
          // For non-authors, only allow engagement field updates
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['likedBy', 'savedBy', 'likesCount', 'savesCount', 'commentsCount'])
        )
      );
      
      // Only author can delete
      allow delete: if isAuthenticated() && request.auth.uid == resource.data.authorId;
      
      // Comments subcollection
      match /comments/{commentId} {
        // Anyone authenticated can read comments
        allow read: if isAuthenticated();
        
        // Authenticated users can create comments
        allow create: if isAuthenticated() && request.auth.uid == request.resource.data.authorId;
        
        // Only comment author can update/delete
        allow update: if isAuthenticated() && request.auth.uid == resource.data.authorId;
        allow delete: if isAuthenticated() && request.auth.uid == resource.data.authorId;
      }
    }
    
    // Achievements collection
    match /achievements/{userId} {
      // Users can only access their own achievements
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }
    
    // User stats collection
    match /user_stats/{userId} {
      // Users can only access their own stats
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }
  }
}
```

### How to Deploy Security Rules
1. Go to **Firestore Database** > **Rules**
2. Replace the existing rules with the above
3. Click **"Publish"**

---

## Step 7: Environment Variables

Create a `.env` file in the KainAI app directory with the following variables:

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Google Sign-In
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com

# Backend API (for server proxy)
EXPO_PUBLIC_API_BASE_URL=http://localhost:5173
```

### Where to Find These Values
1. Go to **Project Settings** > **General**
2. Scroll down to **Your apps**
3. If no app exists, add one (Web, Android, or iOS)
4. Copy the configuration values

---

## Step 8: Android Configuration

### 8.1 Download google-services.json
1. Go to **Project Settings** > **Your apps**
2. Click on your Android app (or add one if needed)
3. Click **"Download google-services.json"**
4. Place it in `KainAI/android/app/google-services.json`

### 8.2 Verify android/app/build.gradle
Ensure these plugins are applied:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 8.3 Verify android/build.gradle
Ensure the Google services classpath is in dependencies:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.2'
    }
}
```

---

## Step 9: iOS Configuration

### 9.1 Download GoogleService-Info.plist
1. Go to **Project Settings** > **Your apps**
2. Click on your iOS app (or add one if needed)
3. Click **"Download GoogleService-Info.plist"**
4. Place it in `KainAI/ios/GoogleService-Info.plist`

### 9.2 Add to Xcode
1. Open the iOS project in Xcode
2. Right-click on the project
3. Select **"Add Files to [Project Name]"**
4. Select the `GoogleService-Info.plist` file

---

## Testing Your Setup

### Test Authentication
1. Run the app: `cd KainAI && npx expo run:android`
2. Try signing in with Google
3. Check Firebase Console > Authentication for the new user

### Test Firestore
1. After signing in, the app should create a user document
2. Check Firebase Console > Firestore Database > users collection
3. Verify the user document was created with correct fields

### Test Demo Mode
1. Without Firebase configuration, the app should work in demo mode
2. All data is stored locally in AsyncStorage
3. Look for `[Demo]` prefixed console logs

### Common Issues

**"Firebase app not initialized"**
- Ensure `google-services.json` is in the correct location
- Run `cd android && ./gradlew clean && cd ..`
- Rebuild the app

**"No user found in Firestore"**
- Check security rules allow reading/writing
- Verify the user ID matches between Auth and Firestore

**"Index required" error**
- Firebase will provide a link to create the missing index
- Click the link and create the index

---

## XP and Level System

The app uses the following XP thresholds for levels (as defined in `statsService.ts`):

| Level | Min XP | Max XP |
|-------|--------|--------|
| Beginner | 0 | 199 |
| Intermediate | 200 | 499 |
| Advanced | 500 | 999 |
| Expert | 1000 | 1999 |
| Master Chef | 2000+ | - |

### XP Rewards (from `XP_REWARDS` constant)
| Action | XP |
|--------|-----|
| Complete Recipe | 20 |
| Share Creation | 15 |
| Complete Achievement | 50 |
| Daily Streak | 5 |
| Weekly Streak Bonus | 25 |
| Community Comment | 5 |
| Rate Recipe | 3 |
| Try New Ingredient | 10 |
| Receive Like | 2 |
| Post Featured | 100 |

---

## Support

If you encounter issues:
1. Check the console logs for `🔥 Firebase` prefixed messages
2. Verify Firebase Console settings match this guide
3. Ensure all required indexes are created
4. Check security rules are deployed correctly

For demo mode testing, the app uses `demo-user-id` as the user ID and stores all data locally.
