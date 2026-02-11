// services/community.service.ts - Client-side community service
import { Platform } from 'react-native';
import axios from 'axios';
import type { 
  CommunityPost, 
  Comment, 
  CommunityStats, 
  PostType,
  Recipe 
} from '../types';

// API base URL
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

/**
 * Community Service - manages social feed and interactions
 */
class CommunityService {
  /**
   * Get community feed posts
   */
  async getFeedPosts(type: PostType | 'all' = 'all', limit: number = 20): Promise<CommunityPost[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/feed`, {
        params: { type, limit },
      });

      if (response.data.ok) {
        return this.parseDates(response.data.posts);
      }
      throw new Error(response.data.error || 'Failed to fetch feed');
    } catch (error: any) {
      console.error('Error fetching feed:', error);
      return [];
    }
  }

  /**
   * Get trending posts
   */
  async getTrendingPosts(limit: number = 10): Promise<CommunityPost[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/trending`, {
        params: { limit },
      });

      if (response.data.ok) {
        return this.parseDates(response.data.posts);
      }
      throw new Error(response.data.error || 'Failed to fetch trending');
    } catch (error: any) {
      console.error('Error fetching trending:', error);
      return [];
    }
  }

  /**
   * Get community statistics
   */
  async getStats(): Promise<CommunityStats> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/stats`);

      if (response.data.ok) {
        return response.data.stats;
      }
      throw new Error(response.data.error || 'Failed to fetch stats');
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      return { totalMembers: 0, totalRecipes: 0, totalPosts: 0 };
    }
  }

  /**
   * Create a new community post
   */
  async createPost(postData: {
    authorId: string;
    type: PostType;
    title: string;
    content: string;
    recipeId?: string;
    recipeTitle?: string;
    rating?: number;
    tags?: string[];
    images?: string[];
  }): Promise<CommunityPost | null> {
    try {
      const response = await axios.post(`${API_BASE}/api/community/posts`, postData);

      if (response.data.ok) {
        return this.parseDates([response.data.post])[0];
      }
      throw new Error(response.data.error || 'Failed to create post');
    } catch (error: any) {
      console.error('Error creating post:', error);
      return null;
    }
  }

  /**
   * Create a "success" post after completing a recipe
   */
  async shareRecipeSuccess(
    userId: string,
    recipe: Recipe,
    rating: number,
    comment: string,
    images?: string[]
  ): Promise<CommunityPost | null> {
    // Generate hashtags from recipe tags
    const tags = recipe.tags.map(tag => `#${tag.replace(/\s+/g, '')}`);

    return this.createPost({
      authorId: userId,
      type: 'success',
      title: `${recipe.title}`,
      content: comment,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      rating,
      tags,
      images,
    });
  }

  /**
   * Get a single post
   */
  async getPost(postId: string): Promise<CommunityPost | null> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/posts/${postId}`);

      if (response.data.ok) {
        return this.parseDates([response.data.post])[0];
      }
      throw new Error(response.data.error || 'Post not found');
    } catch (error: any) {
      console.error('Error fetching post:', error);
      return null;
    }
  }

  /**
   * Like or unlike a post
   */
  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; newCount: number } | null> {
    try {
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/like`, {
        userId,
      });

      if (response.data.ok) {
        return { liked: response.data.liked, newCount: response.data.newCount };
      }
      throw new Error(response.data.error || 'Failed to toggle like');
    } catch (error: any) {
      console.error('Error toggling like:', error);
      return null;
    }
  }

  /**
   * Save or unsave a post
   */
  async toggleSave(postId: string, userId: string): Promise<{ saved: boolean; newCount: number } | null> {
    try {
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/save`, {
        userId,
      });

      if (response.data.ok) {
        return { saved: response.data.saved, newCount: response.data.newCount };
      }
      throw new Error(response.data.error || 'Failed to toggle save');
    } catch (error: any) {
      console.error('Error toggling save:', error);
      return null;
    }
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit: number = 50): Promise<Comment[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/posts/${postId}/comments`, {
        params: { limit },
      });

      if (response.data.ok) {
        return response.data.comments.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
        }));
      }
      throw new Error(response.data.error || 'Failed to fetch comments');
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  /**
   * Add a comment to a post
   */
  async addComment(postId: string, authorId: string, content: string): Promise<Comment | null> {
    try {
      const response = await axios.post(`${API_BASE}/api/community/posts/${postId}/comments`, {
        authorId,
        content,
      });

      if (response.data.ok) {
        return {
          ...response.data.comment,
          createdAt: new Date(response.data.comment.createdAt),
        };
      }
      throw new Error(response.data.error || 'Failed to add comment');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      return null;
    }
  }

  /**
   * Get posts by a specific user
   */
  async getUserPosts(userId: string, limit: number = 20): Promise<CommunityPost[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/users/${userId}/posts`, {
        params: { limit },
      });

      if (response.data.ok) {
        return this.parseDates(response.data.posts);
      }
      throw new Error(response.data.error || 'Failed to fetch user posts');
    } catch (error: any) {
      console.error('Error fetching user posts:', error);
      return [];
    }
  }

  /**
   * Get posts saved by a user
   */
  async getSavedPosts(userId: string, limit: number = 20): Promise<CommunityPost[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/users/${userId}/saved`, {
        params: { limit },
      });

      if (response.data.ok) {
        return this.parseDates(response.data.posts);
      }
      throw new Error(response.data.error || 'Failed to fetch saved posts');
    } catch (error: any) {
      console.error('Error fetching saved posts:', error);
      return [];
    }
  }

  /**
   * Search posts
   */
  async searchPosts(query: string, limit: number = 20): Promise<CommunityPost[]> {
    try {
      const response = await axios.get(`${API_BASE}/api/community/search`, {
        params: { q: query, limit },
      });

      if (response.data.ok) {
        return this.parseDates(response.data.posts);
      }
      throw new Error(response.data.error || 'Failed to search posts');
    } catch (error: any) {
      console.error('Error searching posts:', error);
      return [];
    }
  }

  /**
   * Delete a post
   */
  async deletePost(postId: string, userId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE}/api/community/posts/${postId}`, {
        data: { userId },
      });

      return response.data.ok;
    } catch (error: any) {
      console.error('Error deleting post:', error);
      return false;
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Check if current user has liked a post
   */
  hasUserLiked(post: CommunityPost, userId: string): boolean {
    return post.likedBy.includes(userId);
  }

  /**
   * Check if current user has saved a post
   */
  hasUserSaved(post: CommunityPost, userId: string): boolean {
    return post.savedBy.includes(userId);
  }

  /**
   * Parse date strings to Date objects
   */
  private parseDates(posts: any[]): CommunityPost[] {
    return posts.map(post => ({
      ...post,
      createdAt: new Date(post.createdAt?._seconds ? post.createdAt._seconds * 1000 : post.createdAt),
      updatedAt: new Date(post.updatedAt?._seconds ? post.updatedAt._seconds * 1000 : post.updatedAt),
    }));
  }
}

export const communityService = new CommunityService();
export default communityService;
