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

/**
 * Get community feed posts
 * @param {Object} options - Query options
 */
async function getFeedPosts(options = {}) {
  const { type, limit = 20, startAfter = null } = options;
  
  let query = db.collection('community_posts')
    .orderBy('createdAt', 'desc');
  
  if (type && type !== 'all') {
    query = query.where('type', '==', type);
  }
  
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  
  query = query.limit(limit);
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  const usersSnapshot = await db.collection('users').get();
  const postsSnapshot = await db.collection('community_posts').get();
  const recipesSnapshot = await db.collectionGroup('recipes').get();
  
  return {
    totalMembers: usersSnapshot.size,
    totalRecipes: recipesSnapshot.size,
    totalPosts: postsSnapshot.size
  };
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
