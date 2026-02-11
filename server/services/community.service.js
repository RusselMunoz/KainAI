// services/community.service.js
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Create a new community post
 * @param {Object} postData - Post data
 * @returns {Object} Created post with ID
 */
async function createPost(postData) {
  const { authorId, type, title, content, recipeId, recipeTitle, rating, tags, images } = postData;
  
  if (!authorId) throw new Error('Author ID is required');
  if (!title) throw new Error('Post title is required');
  
  // Get author info
  const userDoc = await db.collection('users').doc(authorId).get();
  if (!userDoc.exists) throw new Error('Author not found');
  
  const userData = userDoc.data();
  const now = admin.firestore.Timestamp.now();
  
  const post = {
    authorId,
    authorName: userData.displayName || userData.username || 'Anonymous',
    authorPhotoURL: userData.photoURL || null,
    authorLevel: userData.level || 'Beginner',
    type: type || 'recipe',
    title,
    content: content || '',
    recipeId: recipeId || null,
    recipeTitle: recipeTitle || null,
    recipeThumbnail: null,
    images: images || [],
    tags: tags || [],
    rating: rating || 0,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
    likedBy: [],
    savedBy: [],
    isTrending: false,
    isFeatured: false,
    createdAt: now,
    updatedAt: now
  };

  // Create the post
  const postRef = db.collection('community_posts').doc();
  post.id = postRef.id;
  await postRef.set(post);

  // Increment user's postsCreated count
  await db.collection('users').doc(authorId).update({
    postsCreated: admin.firestore.FieldValue.increment(1),
    xp: admin.firestore.FieldValue.increment(25), // 25 XP for sharing
    updated_at: now
  });

  return post;
}

// Demo posts for when Firestore is empty or unavailable
const DEMO_POSTS = [
  {
    id: 'demo-post-1',
    authorId: 'demo-user-1',
    authorName: 'Chef Maria',
    authorPhotoURL: null,
    authorLevel: 'Advanced',
    type: 'recipe',
    title: 'Creamy Garlic Chicken Pasta',
    content: 'Finally perfected my grandmother\'s recipe! The secret is to use freshly grated parmesan and let the sauce simmer for 15 minutes.',
    recipeId: 'demo-recipe-1',
    recipeTitle: 'Creamy Garlic Chicken Pasta',
    images: [],
    tags: ['#pasta', '#chicken', '#creamy', '#Italian'],
    rating: 5,
    likesCount: 24,
    commentsCount: 8,
    savesCount: 12,
    likedBy: [],
    savedBy: [],
    isTrending: true,
    isFeatured: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'demo-post-2',
    authorId: 'demo-user-2',
    authorName: 'HomeCook John',
    authorPhotoURL: null,
    authorLevel: 'Intermediate',
    type: 'tip',
    title: 'Pro tip: Toast your spices!',
    content: 'Always toast whole spices in a dry pan before grinding them. It releases their essential oils and makes everything taste so much better. Game changer for curries!',
    recipeId: null,
    images: [],
    tags: ['#cookingtips', '#spices', '#curry'],
    rating: 0,
    likesCount: 45,
    commentsCount: 12,
    savesCount: 28,
    likedBy: [],
    savedBy: [],
    isTrending: true,
    isFeatured: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'demo-post-3',
    authorId: 'demo-user-3',
    authorName: 'NoviceChef',
    authorPhotoURL: null,
    authorLevel: 'Beginner',
    type: 'success',
    title: 'Made my first stir-fry! 🎉',
    content: 'Thanks to Cheffy for the easy recipe! Used chicken, garlic, soy sauce and rice. My family loved it!',
    recipeId: 'demo-recipe-2',
    recipeTitle: 'Quick Chicken Stir-Fry',
    images: [],
    tags: ['#firsttime', '#stirfry', '#success', '#chicken'],
    rating: 4,
    likesCount: 18,
    commentsCount: 5,
    savesCount: 3,
    likedBy: [],
    savedBy: [],
    isTrending: false,
    isFeatured: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'demo-post-4',
    authorId: 'demo-user-4',
    authorName: 'CuriousCook',
    authorPhotoURL: null,
    authorLevel: 'Beginner',
    type: 'question',
    title: 'Best way to cook rice without a rice cooker?',
    content: 'I always end up with either mushy or undercooked rice. Any tips for perfect stovetop rice?',
    recipeId: null,
    images: [],
    tags: ['#help', '#rice', '#question', '#basics'],
    rating: 0,
    likesCount: 8,
    commentsCount: 15,
    savesCount: 4,
    likedBy: [],
    savedBy: [],
    isTrending: false,
    isFeatured: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

/**
 * Get community feed posts
 * @param {Object} options - Query options
 */
async function getFeedPosts(options = {}) {
  const { type, limit = 20, startAfter = null } = options;
  
  try {
    // Build query - put where BEFORE orderBy to avoid index issues
    let query = db.collection('community_posts');
    
    if (type && type !== 'all') {
      query = query.where('type', '==', type);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (startAfter) {
      query = query.startAfter(startAfter);
    }
    
    query = query.limit(limit);
    
    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // If no posts found, return demo data
    if (posts.length === 0) {
      console.log('📝 No community posts found, returning demo data');
      let demoPosts = [...DEMO_POSTS];
      if (type && type !== 'all') {
        demoPosts = demoPosts.filter(p => p.type === type);
      }
      return demoPosts.slice(0, limit);
    }
    
    return posts;
  } catch (error) {
    console.error('❌ Error fetching feed, returning demo data:', error.message);
    // Return demo data as fallback
    let demoPosts = [...DEMO_POSTS];
    if (type && type !== 'all') {
      demoPosts = demoPosts.filter(p => p.type === type);
    }
    return demoPosts.slice(0, limit);
  }
}

/**
 * Get trending posts
 */
async function getTrendingPosts(limit = 10) {
  const snapshot = await db.collection('community_posts')
    .where('isTrending', '==', true)
    .orderBy('likesCount', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get a single post by ID
 */
async function getPost(postId) {
  if (!postId) throw new Error('Post ID is required');
  
  const doc = await db.collection('community_posts').doc(postId).get();
  
  if (!doc.exists) throw new Error('Post not found');
  
  return { id: doc.id, ...doc.data() };
}

/**
 * Like/unlike a post
 */
async function toggleLike(postId, userId) {
  if (!postId || !userId) throw new Error('Post ID and User ID are required');
  
  const postRef = db.collection('community_posts').doc(postId);
  const postDoc = await postRef.get();
  
  if (!postDoc.exists) throw new Error('Post not found');
  
  const post = postDoc.data();
  const isLiked = post.likedBy.includes(userId);
  const now = admin.firestore.Timestamp.now();
  
  if (isLiked) {
    // Unlike
    await postRef.update({
      likedBy: admin.firestore.FieldValue.arrayRemove(userId),
      likesCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: now
    });
    return { liked: false, newCount: post.likesCount - 1 };
  } else {
    // Like
    await postRef.update({
      likedBy: admin.firestore.FieldValue.arrayUnion(userId),
      likesCount: admin.firestore.FieldValue.increment(1),
      updatedAt: now
    });
    
    // Update author's totalLikesReceived
    await db.collection('users').doc(post.authorId).update({
      totalLikesReceived: admin.firestore.FieldValue.increment(1)
    });
    
    // Check if post should be marked as trending (10+ likes)
    if (post.likesCount + 1 >= 10 && !post.isTrending) {
      await postRef.update({ isTrending: true });
    }
    
    return { liked: true, newCount: post.likesCount + 1 };
  }
}

/**
 * Save/unsave a post to user's saved collection
 */
async function toggleSave(postId, userId) {
  if (!postId || !userId) throw new Error('Post ID and User ID are required');
  
  const postRef = db.collection('community_posts').doc(postId);
  const postDoc = await postRef.get();
  
  if (!postDoc.exists) throw new Error('Post not found');
  
  const post = postDoc.data();
  const isSaved = post.savedBy.includes(userId);
  const now = admin.firestore.Timestamp.now();
  
  if (isSaved) {
    // Unsave
    await postRef.update({
      savedBy: admin.firestore.FieldValue.arrayRemove(userId),
      savesCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: now
    });
    return { saved: false, newCount: post.savesCount - 1 };
  } else {
    // Save
    await postRef.update({
      savedBy: admin.firestore.FieldValue.arrayUnion(userId),
      savesCount: admin.firestore.FieldValue.increment(1),
      updatedAt: now
    });
    
    // Update author's totalSaves
    await db.collection('users').doc(post.authorId).update({
      totalSaves: admin.firestore.FieldValue.increment(1)
    });
    
    return { saved: true, newCount: post.savesCount + 1 };
  }
}

/**
 * Add a comment to a post
 */
async function addComment(postId, commentData) {
  const { authorId, content } = commentData;
  
  if (!postId || !authorId || !content) {
    throw new Error('Post ID, Author ID, and content are required');
  }
  
  // Get author info
  const userDoc = await db.collection('users').doc(authorId).get();
  if (!userDoc.exists) throw new Error('Author not found');
  
  const userData = userDoc.data();
  const now = admin.firestore.Timestamp.now();
  
  const comment = {
    authorId,
    authorName: userData.displayName || userData.username || 'Anonymous',
    authorPhotoURL: userData.photoURL || null,
    content,
    likesCount: 0,
    likedBy: [],
    createdAt: now
  };
  
  // Add comment to subcollection
  const commentRef = db.collection('community_posts').doc(postId).collection('comments').doc();
  comment.id = commentRef.id;
  await commentRef.set(comment);
  
  // Update post's comment count
  await db.collection('community_posts').doc(postId).update({
    commentsCount: admin.firestore.FieldValue.increment(1),
    updatedAt: now
  });
  
  return comment;
}

/**
 * Get comments for a post
 */
async function getComments(postId, limit = 50) {
  if (!postId) throw new Error('Post ID is required');
  
  const snapshot = await db.collection('community_posts')
    .doc(postId)
    .collection('comments')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get posts by a specific user
 */
async function getUserPosts(userId, limit = 20) {
  if (!userId) throw new Error('User ID is required');
  
  const snapshot = await db.collection('community_posts')
    .where('authorId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get posts that user has saved
 */
async function getSavedPosts(userId, limit = 20) {
  if (!userId) throw new Error('User ID is required');
  
  const snapshot = await db.collection('community_posts')
    .where('savedBy', 'array-contains', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Search posts by tags or title
 */
async function searchPosts(searchTerm, limit = 20) {
  // Firestore doesn't support full-text search natively
  // This is a simple implementation that searches by tags
  // For production, consider using Algolia or Elasticsearch
  
  const searchLower = searchTerm.toLowerCase();
  
  const snapshot = await db.collection('community_posts')
    .where('tags', 'array-contains', `#${searchLower}`)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get community statistics
 */
async function getCommunityStats() {
  try {
    const usersSnapshot = await db.collection('users').get();
    const postsSnapshot = await db.collection('community_posts').get();
    const recipesSnapshot = await db.collectionGroup('recipes').get();
    
    const stats = {
      totalMembers: usersSnapshot.size,
      totalRecipes: recipesSnapshot.size,
      totalPosts: postsSnapshot.size
    };
    
    // Return demo stats if everything is empty
    if (stats.totalMembers === 0 && stats.totalRecipes === 0 && stats.totalPosts === 0) {
      console.log('📊 No community stats, returning demo data');
      return {
        totalMembers: 1234,
        totalRecipes: 567,
        totalPosts: 89
      };
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Error fetching stats, returning demo data:', error.message);
    return {
      totalMembers: 1234,
      totalRecipes: 567,
      totalPosts: 89
    };
  }
}

/**
 * Delete a post (only by author)
 */
async function deletePost(postId, userId) {
  if (!postId || !userId) throw new Error('Post ID and User ID are required');
  
  const postRef = db.collection('community_posts').doc(postId);
  const postDoc = await postRef.get();
  
  if (!postDoc.exists) throw new Error('Post not found');
  
  const post = postDoc.data();
  
  if (post.authorId !== userId) {
    throw new Error('Unauthorized: Only the author can delete this post');
  }
  
  // Delete all comments first
  const commentsSnapshot = await postRef.collection('comments').get();
  const batch = db.batch();
  
  commentsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  batch.delete(postRef);
  
  // Decrement user's postsCreated
  const userRef = db.collection('users').doc(userId);
  batch.update(userRef, {
    postsCreated: admin.firestore.FieldValue.increment(-1)
  });
  
  await batch.commit();
  
  return { success: true };
}

module.exports = {
  createPost,
  getFeedPosts,
  getTrendingPosts,
  getPost,
  toggleLike,
  toggleSave,
  addComment,
  getComments,
  getUserPosts,
  getSavedPosts,
  searchPosts,
  getCommunityStats,
  deletePost
};
