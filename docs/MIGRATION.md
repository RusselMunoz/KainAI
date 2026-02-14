# KainAI Migration Guide

This document outlines database changes and Firestore index requirements for the recipe sharing feature.

## Schema Changes

### Recipe Interface

Added optional field to `Recipe` interface in `types/index.ts`:

```typescript
sharedAt: Date | null;  // Timestamp when recipe was shared to community
```

**Note:** The `isPublic` field already exists in the Recipe interface. Existing recipes without `isPublic` will be treated as private (`isPublic: false` by default).

### Community Posts

The `community_posts` collection now filters by `isPublic: true` to only show publicly shared recipes.

## Required Firestore Indexes

Create the following composite indexes in Firebase Console or via `firestore.indexes.json`:

### 1. Community Posts Feed Index
```
Collection: community_posts
Fields:
  - isPublic: Ascending
  - createdAt: Descending
```

### 2. Public Recipes Collection Group Index (Optional)
For cross-user public recipe queries:
```
Collection Group: recipes
Fields:
  - isPublic: Ascending
  - createdAt: Descending
```

## Migration Steps

### Step 1: Create Firestore Indexes

1. Go to Firebase Console → Firestore Database → Indexes
2. Create the composite indexes listed above
3. Wait for indexes to build (may take a few minutes)

### Step 2: Verify Existing Data

Existing recipes without `isPublic` field will default to private (not shared).
No data migration is required - the system handles missing fields gracefully.

### Step 3: Update Community Posts (If Needed)

If you have existing community posts without the `isPublic` field, run this one-time migration:

```javascript
// Run in Firebase Admin SDK or Cloud Functions
const admin = require('firebase-admin');
const db = admin.firestore();

async function migrateCommunityPosts() {
  const postsRef = db.collection('community_posts');
  const snapshot = await postsRef.get();
  
  const batch = db.batch();
  let count = 0;
  
  snapshot.forEach(doc => {
    if (doc.data().isPublic === undefined) {
      batch.update(doc.ref, { isPublic: true }); // Existing posts are public
      count++;
    }
    
    // Firestore batches limited to 500 operations
    if (count >= 500) {
      console.log('Batch limit reached, run script again');
    }
  });
  
  await batch.commit();
  console.log(`Migrated ${count} posts`);
}

migrateCommunityPosts();
```

## Feature Summary

### Recipe Sharing Flow

1. User creates/completes a recipe (private by default)
2. User taps "Share" button in RecipeDetail view
3. Recipe is marked `isPublic: true` and `sharedAt` timestamp is set
4. A community post is created automatically
5. User earns +15 points for sharing
6. Recipe appears in community feed

### Unsharing Flow

1. User taps "Make Private" (lock icon) in RecipeDetail
2. Recipe is marked `isPublic: false`
3. Associated community post is deleted
4. Recipe no longer appears in community feed

## API Endpoints Added

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/recipes/:userId/:recipeId/share` | Share recipe to community |
| POST | `/api/recipes/:userId/:recipeId/unshare` | Make recipe private |
| GET | `/api/recipes/public?limit=50` | Get all public recipes |

## Client Service Methods

Added to `services/recipe.service.ts`:

- `shareRecipeToCommunity(recipeId: string, userId: string)` - Share recipe
- `unshareRecipe(recipeId: string, userId: string)` - Make private
- `getPublicRecipes(limit?: number)` - Fetch public recipes

## Backward Compatibility

All changes are additive and backward compatible:
- Existing recipes remain private unless explicitly shared
- Missing `isPublic` fields default to `false`
- Existing community posts will need `isPublic: true` added to remain visible
