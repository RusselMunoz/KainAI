// services/communityService.ts - Community posts, comments, and interactions for Firebase/Firestore
// Handles community feed, likes, saves, and comments

import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoMode, generateId, logFirebaseOp, serverTimestamp, timestampToDate } from '../config/firebase';
import type { CommunityPost, Comment, PostType, UserLevel } from '../types';

// API base URL for backend
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Storage keys for demo mode
const DEMO_POSTS_KEY = '@kainai_demo_posts';
const DEMO_COMMENTS_KEY = '@kainai_demo_comments';

/**
 * Community post data for creation
 */
export interface CommunityPostData {
  type: PostType;
  title: string;
  content: string;
  recipeId?: string;
  recipeTitle?: string;
  recipeThumbnail?: string;
  images?: string[];
  tags?: string[];
  rating?: number;
}

/**
 * Comment data for creation
 */
export interface CommentData {
  content: string;
}

/**
 * Community Service class - handles all community-related Firebase operations
 */
class CommunityService {
  /**
   * Create a new community post
   * Returns the new post ID
   */
  async createCommunityPost(userId: string, postData: CommunityPostData): Promise<string> {
    const postId = generateId();
    
    if (isDemoMode(userId)) {
      console.log('📝 [Demo] Creating community post locally:', postId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        const posts: CommunityPost[] = stored ? JSON.parse(stored) : [];
        
        const newPost: CommunityPost = {
          id: postId,
          authorId: userId,
          authorName: 'Demo Chef',
          authorPhotoURL: null,
          authorLevel: 'Beginner',
          type: postData.type,
          title: postData.title,
          content: postData.content,
          recipeId: postData.recipeId || null,
          recipeTitle: postData.recipeTitle || null,
          recipeThumbnail: postData.recipeThumbnail || null,
          images: postData.images || [],
          tags: postData.tags || [],
          rating: postData.rating || 0,
          likesCount: 0,
          commentsCount: 0,
          savesCount: 0,
          likedBy: [],
          savedBy: [],
          isTrending: false,
          isFeatured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        posts.unshift(newPost);
        await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
        
        return postId;
      } catch (error) {
        console.error('Error creating demo post:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('CREATE', 'community_posts', postId);
      
      const response = await axios.post(`${API_BASE}/api/community/posts`, {
        ...postData,
        authorId: userId,
      });
      
      if (response.data.ok && response.data.post) {
        console.log('✅ Community post created:', response.data.post.id);
        return response.data.post.id;
      }
      
      throw new Error('Failed to create post');
    } catch (error: any) {
      console.error('❌ Error creating community post:', error.message);
      throw error;
    }
  }

  /**
   * Get community feed
   * Optionally filter by type
   */
  async getCommunityFeed(filter?: string, limit: number = 20): Promise<CommunityPost[]> {
    // Check for demo posts first
    try {
      const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
      const demoPosts: CommunityPost[] = stored ? JSON.parse(stored) : [];
      if (demoPosts.length > 0) {
        console.log(`📖 [Demo] Found ${demoPosts.length} posts locally`);
      }
    } catch (error) {
      console.error('Error checking demo posts:', error);
    }

    try {
      logFirebaseOp('QUERY', 'community_posts', `filter:${filter || 'all'}`);
      
      const params: any = { limit };
      if (filter && filter !== 'all') {
        params.type = filter;
      }
      
      const response = await axios.get(`${API_BASE}/api/community/feed`, { params });
      
      if (response.data.ok && response.data.posts) {
        console.log(`✅ Fetched ${response.data.posts.length} community posts`);
        return response.data.posts.map((post: any) => this.parsePostDates(post));
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting community feed:', error.message);
      
      // Return demo posts as fallback
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          return posts.map(post => this.parsePostDates(post));
        }
      } catch (e) {
        console.error('Error loading demo posts:', e);
      }
      
      return [];
    }
  }

  /**
   * Get a single post
   */
  async getPost(postId: string): Promise<CommunityPost | null> {
    // Check demo storage first
    try {
      const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
      if (stored) {
        const posts: CommunityPost[] = JSON.parse(stored);
        const post = posts.find(p => p.id === postId);
        if (post) {
          console.log('📖 [Demo] Found post locally:', postId);
          return this.parsePostDates(post);
        }
      }
    } catch (error) {
      console.error('Error checking demo posts:', error);
    }

    try {
      logFirebaseOp('GET', 'community_posts', postId);
      
      const response = await axios.get(`${API_BASE}/api/community/posts/${postId}`);
      
      if (response.data.ok && response.data.post) {
        console.log('✅ Post fetched successfully:', postId);
        return this.parsePostDates(response.data.post);
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Error getting post:', error.message);
      return null;
    }
  }

  /**
   * Update a post
   */
  async updatePost(postId: string, userId: string, updates: Partial<CommunityPost>): Promise<void> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('📝 [Demo] Updating post locally:', postId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          const index = posts.findIndex(p => p.id === postId);
          if (index !== -1) {
            posts[index] = { ...posts[index], ...updates, updatedAt: new Date() };
            await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
          }
        }
        return;
      } catch (error) {
        console.error('Error updating demo post:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'community_posts', postId);
      
      await axios.patch(`${API_BASE}/api/community/posts/${postId}`, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Post updated:', postId);
    } catch (error: any) {
      console.error('❌ Error updating post:', error.message);
      throw error;
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string, userId: string): Promise<void> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('🗑️ [Demo] Deleting post locally:', postId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          const filtered = posts.filter(p => p.id !== postId);
          await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(filtered));
        }
        // Also delete associated comments
        const commentsStored = await AsyncStorage.getItem(DEMO_COMMENTS_KEY);
        if (commentsStored) {
          const allComments = JSON.parse(commentsStored);
          delete allComments[postId];
          await AsyncStorage.setItem(DEMO_COMMENTS_KEY, JSON.stringify(allComments));
        }
        return;
      } catch (error) {
        console.error('Error deleting demo post:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('DELETE', 'community_posts', postId);
      
      await axios.delete(`${API_BASE}/api/community/posts/${postId}`, {
        data: { userId },
      });
      
      console.log('✅ Post deleted:', postId);
    } catch (error: any) {
      console.error('❌ Error deleting post:', error.message);
      throw error;
    }
  }

  /**
   * Toggle like on a post
   * Returns true if now liked, false if unliked
   */
  async toggleLike(postId: string, userId: string): Promise<boolean> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('❤️ [Demo] Toggling like locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          const index = posts.findIndex(p => p.id === postId);
          if (index !== -1) {
            const post = posts[index];
            const likedIndex = post.likedBy.indexOf(userId);
            if (likedIndex === -1) {
              post.likedBy.push(userId);
              post.likesCount++;
              await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
              return true;
            } else {
              post.likedBy.splice(likedIndex, 1);
              post.likesCount = Math.max(0, post.likesCount - 1);
              await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
              return false;
            }
          }
        }
        return false;
      } catch (error) {
        console.error('Error toggling demo like:', error);
        return false;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'community_posts', postId);
      
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/like`, {
        userId,
      });
      
      if (response.data.ok) {
        console.log(`${response.data.liked ? '❤️' : '💔'} Like toggled:`, postId);
        return response.data.liked;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Error toggling like:', error.message);
      throw error;
    }
  }

  /**
   * Toggle save on a post
   * Returns true if now saved, false if unsaved
   */
  async toggleSave(postId: string, userId: string): Promise<boolean> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('🔖 [Demo] Toggling save locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          const index = posts.findIndex(p => p.id === postId);
          if (index !== -1) {
            const post = posts[index];
            const savedIndex = post.savedBy.indexOf(userId);
            if (savedIndex === -1) {
              post.savedBy.push(userId);
              post.savesCount++;
              await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
              return true;
            } else {
              post.savedBy.splice(savedIndex, 1);
              post.savesCount = Math.max(0, post.savesCount - 1);
              await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
              return false;
            }
          }
        }
        return false;
      } catch (error) {
        console.error('Error toggling demo save:', error);
        return false;
      }
    }

    try {
      logFirebaseOp('UPDATE', 'community_posts', postId);
      
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/save`, {
        userId,
      });
      
      if (response.data.ok) {
        console.log(`${response.data.saved ? '🔖' : '📌'} Save toggled:`, postId);
        return response.data.saved;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Error toggling save:', error.message);
      throw error;
    }
  }

  /**
   * Add a comment to a post
   * Returns the new comment ID
   */
  async addComment(postId: string, userId: string, commentData: CommentData): Promise<string> {
    const commentId = generateId();
    
    if (isDemoMode(userId)) {
      console.log('💬 [Demo] Adding comment locally:', commentId);
      try {
        // Add to comments storage
        const stored = await AsyncStorage.getItem(DEMO_COMMENTS_KEY);
        const allComments = stored ? JSON.parse(stored) : {};
        const postComments: Comment[] = allComments[postId] || [];
        
        const newComment: Comment = {
          id: commentId,
          authorId: userId,
          authorName: 'Demo Chef',
          authorPhotoURL: null,
          content: commentData.content,
          likesCount: 0,
          likedBy: [],
          createdAt: new Date(),
        };
        
        postComments.push(newComment);
        allComments[postId] = postComments;
        await AsyncStorage.setItem(DEMO_COMMENTS_KEY, JSON.stringify(allComments));
        
        // Update post comment count
        const postsStored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (postsStored) {
          const posts: CommunityPost[] = JSON.parse(postsStored);
          const postIndex = posts.findIndex(p => p.id === postId);
          if (postIndex !== -1) {
            posts[postIndex].commentsCount++;
            await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
          }
        }
        
        return commentId;
      } catch (error) {
        console.error('Error adding demo comment:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('CREATE', `community_posts/${postId}/comments`, commentId);
      
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/comments`, {
        userId,
        content: commentData.content,
      });
      
      if (response.data.ok && response.data.comment) {
        console.log('✅ Comment added:', response.data.comment.id);
        return response.data.comment.id;
      }
      
      throw new Error('Failed to add comment');
    } catch (error: any) {
      console.error('❌ Error adding comment:', error.message);
      throw error;
    }
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit: number = 50): Promise<Comment[]> {
    // Check demo storage first
    try {
      const stored = await AsyncStorage.getItem(DEMO_COMMENTS_KEY);
      if (stored) {
        const allComments = JSON.parse(stored);
        const postComments: Comment[] = allComments[postId] || [];
        if (postComments.length > 0) {
          console.log(`📖 [Demo] Found ${postComments.length} comments locally`);
          return postComments.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
          }));
        }
      }
    } catch (error) {
      console.error('Error checking demo comments:', error);
    }

    try {
      logFirebaseOp('QUERY', `community_posts/${postId}/comments`);
      
      const response = await axios.get(`${API_BASE}/api/community/posts/${postId}/comments`, {
        params: { limit },
      });
      
      if (response.data.ok && response.data.comments) {
        console.log(`✅ Fetched ${response.data.comments.length} comments`);
        return response.data.comments.map((c: any) => ({
          ...c,
          createdAt: timestampToDate(c.createdAt),
        }));
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting comments:', error.message);
      return [];
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(postId: string, commentId: string, userId: string): Promise<void> {
    // Handle demo mode
    if (isDemoMode(userId)) {
      console.log('🗑️ [Demo] Deleting comment locally:', commentId);
      try {
        const stored = await AsyncStorage.getItem(DEMO_COMMENTS_KEY);
        if (stored) {
          const allComments = JSON.parse(stored);
          const postComments: Comment[] = allComments[postId] || [];
          const filtered = postComments.filter(c => c.id !== commentId);
          allComments[postId] = filtered;
          await AsyncStorage.setItem(DEMO_COMMENTS_KEY, JSON.stringify(allComments));
          
          // Update post comment count
          const postsStored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
          if (postsStored) {
            const posts: CommunityPost[] = JSON.parse(postsStored);
            const postIndex = posts.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
              posts[postIndex].commentsCount = Math.max(0, posts[postIndex].commentsCount - 1);
              await AsyncStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(posts));
            }
          }
        }
        return;
      } catch (error) {
        console.error('Error deleting demo comment:', error);
        throw error;
      }
    }

    try {
      logFirebaseOp('DELETE', `community_posts/${postId}/comments`, commentId);
      
      await axios.delete(`${API_BASE}/api/community/posts/${postId}/comments/${commentId}`, {
        data: { userId },
      });
      
      console.log('✅ Comment deleted:', commentId);
    } catch (error: any) {
      console.error('❌ Error deleting comment:', error.message);
      throw error;
    }
  }

  /**
   * Get trending posts
   */
  async getTrendingPosts(limit: number = 10): Promise<CommunityPost[]> {
    try {
      logFirebaseOp('QUERY', 'community_posts', 'trending');
      
      const response = await axios.get(`${API_BASE}/api/community/trending`, {
        params: { limit },
      });
      
      if (response.data.ok && response.data.posts) {
        console.log(`✅ Fetched ${response.data.posts.length} trending posts`);
        return response.data.posts.map((post: any) => this.parsePostDates(post));
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting trending posts:', error.message);
      return [];
    }
  }

  /**
   * Get user's saved posts
   */
  async getSavedPosts(userId: string): Promise<CommunityPost[]> {
    if (isDemoMode(userId)) {
      console.log('📖 [Demo] Getting saved posts locally');
      try {
        const stored = await AsyncStorage.getItem(DEMO_POSTS_KEY);
        if (stored) {
          const posts: CommunityPost[] = JSON.parse(stored);
          return posts
            .filter(p => p.savedBy.includes(userId))
            .map(p => this.parsePostDates(p));
        }
        return [];
      } catch (error) {
        console.error('Error getting demo saved posts:', error);
        return [];
      }
    }

    try {
      logFirebaseOp('QUERY', 'community_posts', `savedBy:${userId}`);
      
      const response = await axios.get(`${API_BASE}/api/community/saved`, {
        params: { userId },
      });
      
      if (response.data.ok && response.data.posts) {
        console.log(`✅ Fetched ${response.data.posts.length} saved posts`);
        return response.data.posts.map((post: any) => this.parsePostDates(post));
      }
      
      return [];
    } catch (error: any) {
      console.error('❌ Error getting saved posts:', error.message);
      return [];
    }
  }

  /**
   * Helper: Parse post date fields
   */
  private parsePostDates(post: any): CommunityPost {
    return {
      ...post,
      createdAt: timestampToDate(post.createdAt),
      updatedAt: timestampToDate(post.updatedAt),
    };
  }
}

export const communityService = new CommunityService();
export default communityService;
