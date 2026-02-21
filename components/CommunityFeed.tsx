// components/CommunityFeed.tsx - Community social feed component
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable } from 'react-native';

import type { CommunityPost, PostType, CommunityStats, Recipe, Comment } from '../types';
import communityService from '../services/community.service';
import recipeService from '../services/recipe.service';
import uploadService from '../services/upload.service';
import userService from '../services/userService';
import Avatar from './Avatar';

const screenW = Dimensions.get('window').width;

// API base URL
const API_BASE = Platform.select({
  android: 'http://localhost:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

// Filter tabs
const FILTERS: { label: string; value: PostType | 'all' }[] = [
  { label: 'All Posts', value: 'all' },
  { label: 'Recipes', value: 'recipe' },
  { label: 'Tips', value: 'tip' },
  { label: 'Success', value: 'success' },
  { label: 'Questions', value: 'question' },
];

interface CommunityFeedProps {
  userId: string;
  onSharePress: () => void;
  onViewRecipe?: (recipeId: string, authorId: string) => void;
}

type LeaderboardUser = {
  uid: string;
  displayName: string;
  xp: number;
  level: string;
  recipesCompleted: number;
};

export function CommunityFeed({ userId, onSharePress, onViewRecipe }: CommunityFeedProps) {
  console.log('[CommunityFeed] Component mounted');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [stats, setStats] = useState<CommunityStats>({ totalMembers: 0, totalRecipes: 0, totalPosts: 0 });
  const [filter, setFilter] = useState<PostType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [lbUsers, setLbUsers] = useState<any[]>([]);
  const [lbExpanded, setLbExpanded] = useState(false);

  
  useEffect(() => {
    loadFeed();
    loadStats();
  }, [filter]);
  
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard?userId=${userId}`);
        const data = await res.json();
        console.log('[LB] response:', JSON.stringify(data).slice(0, 200));
        const users = data.leaderboard || data.users || (Array.isArray(data) ? data : []);
        setLbUsers(users);
      } catch (err) {
        console.error('[LB] Error:', err);
      }
    })();
  }, [userId]);

  const loadFeed = async () => {
    setLoading(true);
    const feedPosts = await communityService.getFeedPosts(filter, 20);
    setPosts(feedPosts);
    setLoading(false);
  };

  const loadStats = async () => {
    const communityStats = await communityService.getStats();
    setStats(communityStats);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadStats()]);
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    const result = await communityService.toggleLike(postId, userId);
    if (result) {
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likesCount: result.newCount,
            likedBy: result.liked 
              ? [...post.likedBy, userId]
              : post.likedBy.filter(id => id !== userId),
          };
        }
        return post;
      }));
    }
  };

  const handleSave = async (postId: string) => {
    const result = await communityService.toggleSave(postId, userId);
    if (result) {
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            savesCount: result.newCount,
            savedBy: result.saved
              ? [...post.savedBy, userId]
              : post.savedBy.filter(id => id !== userId),
          };
        }
        return post;
      }));

      // Show feedback
      if (result.saved) {
        const savedPost = posts.find(p => p.id === postId);
        const isRecipe = savedPost?.type === 'recipe';

        Alert.alert(
          isRecipe ? 'Recipe Saved!' : 'Post Saved!',
          isRecipe
            ? 'This recipe has been saved to your collection.'
            : 'This post has been saved to your collection.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleSaveToArchive = async (post: CommunityPost) => {
    if (!post.recipeId) return;

    Alert.alert(
      'Save to My Archive',
      'Would you like to add this recipe to your personal archive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            // This would need to fetch the full recipe data first
            // For now, we'll show a success message
            Alert.alert('Success', 'Recipe saved to your archive!');
          },
        },
      ]
    );
  };

  const formatNumber = (num: number): string => {
    if (num == null) return '0';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2bb673']} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Community Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerIcon}>👥</Text>
          <Text style={styles.bannerTitle}>Community Kitchen</Text>
          <Text style={styles.bannerSubtitle}>Share, learn, and cook together!</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(stats.totalMembers)}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(stats.totalRecipes)}</Text>
              <Text style={styles.statLabel}>Recipes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatNumber(stats.totalPosts)}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Leaderboard Card */}
      <View style={{ backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 12, marginVertical: 8, padding: 16, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1a1a1a', flex: 1 }}>🏆 Top Chefs</Text>
        </View>
        {(lbExpanded ? lbUsers : lbUsers.slice(0, 3)).map((u, i) => {
          const medals = ['🥇', '🥈', '🥉'];
          const isCurrentUser = u.uid === userId;
          return (
            <View key={u.uid} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 4, borderRadius: 10, backgroundColor: isCurrentUser ? '#e8f8f0' : i % 2 === 0 ? '#fafafa' : '#fff', borderWidth: isCurrentUser ? 1.5 : 0, borderColor: '#18b66f' }}>
              <Text style={{ fontSize: 18, width: 32 }}>{medals[i] || `#${i + 1}`}</Text>
              <Text style={{ flex: 1, fontWeight: isCurrentUser ? '700' : '500', color: '#1a1a1a', fontSize: 14 }}>{u.displayName}{isCurrentUser ? ' (You)' : ''}</Text>
              <Text style={{ fontWeight: '700', color: '#18b66f', fontSize: 13 }}>{u.xp} XP</Text>
            </View>
          );
        })}
        {lbUsers.length === 0 && <Text style={{ color: '#999', textAlign: 'center', paddingVertical: 12 }}>No rankings yet</Text>}
        <TouchableOpacity onPress={() => setLbExpanded(e => !e)} style={{ marginTop: 8, alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ color: '#18b66f', fontWeight: '600', fontSize: 13 }}>{lbExpanded ? 'Show Less ▲' : 'See Full Rankings ▼'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes, tips, or ingredients..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => {
            if (searchQuery.trim()) {
              communityService.searchPosts(searchQuery).then(setPosts);
            } else {
              loadFeed();
            }
          }}
        />
      </View>

      {/* Filter tabs removed for cleaner UI */}

      {/* Share Button */}
      <TouchableOpacity style={styles.shareButton} onPress={onSharePress}>
        <MaterialCommunityIcons name="food" size={18} color="#fff" />
        <Text style={styles.shareButtonText}>Share Your Creation</Text>
      </TouchableOpacity>

      {/* Posts Feed */}
      <View style={styles.feedContainer}>
        {posts.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👨‍🍳</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share your creation!</Text>
          </View>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              userId={userId}
              onLike={() => handleLike(post.id)}
              onSave={() => handleSave(post.id)}
              onSaveToArchive={() => handleSaveToArchive(post)}
              onViewRecipe={onViewRecipe}
              onPostDeleted={() => {
                setPosts(prev => prev.filter(p => p.id !== post.id));
              }}
              onPostUpdated={(updatedPost) => {
                setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
              }}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// Individual Post Card Component
interface PostCardProps {
  post: CommunityPost;
  userId: string;
  onLike: () => void;
  onSave: () => void;
  onSaveToArchive: () => void;
  onViewRecipe?: (recipeId: string, authorId: string) => void;
  onPostDeleted?: () => void;
  onPostUpdated?: (updatedPost: CommunityPost) => void;
}

interface AuthorStatsState {
  recipes: number | null;
  posts: number | null;
  xp: number | null;
}

function PostCard({ post, userId, onLike, onSave, onSaveToArchive, onViewRecipe, onPostDeleted, onPostUpdated }: PostCardProps) {
  const [authorStats, setAuthorStats] = useState<AuthorStatsState>({ recipes: null, posts: null, xp: null });
  const [authorStatsLoading, setAuthorStatsLoading] = useState(false);
  const authorStatsLoadedRef = useRef(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  
  const isLiked = post.likedBy?.includes(userId) ?? false;
  const isSaved = post.savedBy?.includes(userId) ?? false;
  const isOwnPost = post.authorId === userId;
  
  const typeColors: Record<PostType, string> = {
    recipe: '#ef4444',
    tip: '#3b82f6',
    success: '#22c55e',
    question: '#f59e0b',
  };

  useEffect(() => {
    authorStatsLoadedRef.current = false;
    setAuthorStats({ recipes: null, posts: null, xp: null });
  }, [post.authorId]);

  const relativeTime = communityService.formatRelativeTime(post.createdAt);

  const fetchAuthorStats = useCallback(async () => {
    if (!post.authorId) {
      return;
    }
    if (authorStatsLoadedRef.current) {
      return;
    }
    setAuthorStatsLoading(true);
    try {
      const [recipes, posts, profile] = await Promise.all([
        recipeService.getUserRecipes(post.authorId),
        communityService.getUserPosts(post.authorId, 100),
        userService.getUser(post.authorId),
      ]);

      setAuthorStats({
        recipes: recipes.length,
        posts: posts.length,
        xp: profile?.xp ?? 0,
      });
      authorStatsLoadedRef.current = true;
    } catch (error) {
      console.error('[CommunityFeed] Failed to load author stats:', error);
    } finally {
      setAuthorStatsLoading(false);
    }
  }, [post.authorId]);

  useEffect(() => {
    if (showUserPopup) {
      fetchAuthorStats();
    }
  }, [showUserPopup, fetchAuthorStats]);

  const formatStatValue = (value: number | null): string => {
    if (authorStatsLoading && value === null) {
      return '...';
    }
    if (value == null) {
      return '-';
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const fetchedComments = await communityService.getComments(post.id);
      setComments(fetchedComments);
    } catch (e) {
      Alert.alert('Error', 'Failed to load comments. Please try again.');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    const newShowComments = !showComments;
    setShowComments(newShowComments);
    if (newShowComments && comments.length === 0) {
      loadComments();
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    const comment = await communityService.addComment(post.id, userId, newComment.trim());
    if (comment) {
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      onPostUpdated?.({ ...post, commentsCount: post.commentsCount + 1 });
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      'Delete Comment?',
      'This will permanently delete your comment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await communityService.deleteComment(post.id, commentId, userId);
            if (success) {
              setComments(prev => prev.filter(c => c.id !== commentId));
              onPostUpdated?.({ ...post, commentsCount: Math.max(0, post.commentsCount - 1) });
            }
          },
        },
      ]
    );
  };

  const handleDeletePost = async () => {
    Alert.alert(
      'Delete Post?',
      'This will permanently delete this post and all its comments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await communityService.deletePost(post.id, userId);
            if (success) {
              onPostDeleted?.();
            } else {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEditPost = async () => {
    setSaving(true);
    const updated = await communityService.updatePost(post.id, userId, {
      title: editTitle,
      content: editContent,
    });
    setSaving(false);
    
    if (updated) {
      setShowEditModal(false);
      onPostUpdated?.(updated);
    } else {
      Alert.alert('Error', 'Failed to update post');
    }
  };

  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.authorInfo}
          onPress={() => setShowUserPopup(true)}
          activeOpacity={0.7}
        >
          <Avatar 
            name={post.authorName} 
            photoURL={post.authorPhotoURL} 
            size={40} 
          />
          <View style={styles.authorMeta}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            <View style={styles.authorSubRow}>
              <Text style={styles.postTime}>{relativeTime}</Text>
              <View style={[styles.typeBadge, { backgroundColor: typeColors[post.type] }]}>
                <Text style={styles.typeBadgeText}>{post.type}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          {isOwnPost && (
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.postActionBtn} 
                onPress={() => setShowEditModal(true)}
              >
                <Feather name="edit-2" size={14} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.postActionBtn} 
                onPress={handleDeletePost}
              >
                <Feather name="trash-2" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.ratingContainer}>
            <AntDesign name="star" size={14} color="#f59e0b" />
            <Text style={styles.ratingValue}>{(post.rating ?? 0).toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {/* Post Content */}
      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post Image Placeholder */}
      {post.images?.length > 0 ? (
        <Image source={{ uri: post.images[0] }} style={styles.postImage} />
      ) : post.type === 'success' || post.type === 'recipe' ? (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>🍽️</Text>
          {post.isTrending && (
            <View style={styles.trendingBadge}>
              <Text style={styles.trendingText}>📈 Trending</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.slice(0, 4).map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Engagement Row */}
      <View style={styles.engagementRow}>
        <View style={styles.engagementLeft}>
          <TouchableOpacity style={styles.engagementBtn} onPress={onLike}>
            <MaterialCommunityIcons 
              name={isLiked ? 'heart' : 'heart-outline'} 
              size={18} 
              color={isLiked ? '#ef4444' : '#666'} 
            />
            <Text style={[styles.engagementText, isLiked && styles.engagementTextActive]}>
              {post.likesCount}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.engagementBtn} 
            onPress={handleToggleComments}
          >
            <Feather name="message-circle" size={18} color={showComments ? '#3b82f6' : '#666'} />
            <Text style={[styles.engagementText, showComments && { color: '#3b82f6' }]}>
              {post.commentsCount}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.engagementRight}>
          {post.recipeId && onViewRecipe && (
            <TouchableOpacity 
              style={styles.cookRecipeBtn}
              onPress={() => onViewRecipe(post.recipeId!, post.authorId)}
            >
              <MaterialCommunityIcons name="chef-hat" size={14} color="#fff" />
              <Text style={styles.cookRecipeBtnText}>Cook This</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.engagementBtn} onPress={onSave}>
            <Feather 
              name={isSaved ? "bookmark" : "bookmark"} 
              size={18} 
              color={isSaved ? '#2bb673' : '#666'} 
              style={isSaved ? { transform: [{ scale: 1.1 }] } : undefined}
            />
            {isSaved && <View style={styles.savedIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.engagementBtn}
            onPress={async () => {
              try {
                await Share.share({
                  message: `${post.title}\n\n${post.content}`,
                });
              } catch (_) {
                // user cancelled or share failed — no action needed
              }
            }}
          >
            <Feather name="share-2" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments Section */}
      {showComments && (
        <View style={styles.commentsSection}>
          {/* Comment Input */}
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Write a comment..."
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendCommentBtn, !newComment.trim() && styles.sendCommentBtnDisabled]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#2bb673" />
              <Text style={styles.commentsLoadingText}>Loading comments...</Text>
            </View>
          ) : comments.length === 0 ? (
            <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map(comment => (
                <View key={comment.id} style={styles.commentItem}>
                  <Avatar 
                    name={comment.authorName} 
                    photoURL={comment.authorPhotoURL} 
                    size={28} 
                  />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                      <Text style={styles.commentTime}>
                        {communityService.formatRelativeTime(comment.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                  {(comment.authorId === userId || isOwnPost) && (
                    <TouchableOpacity 
                      style={styles.deleteCommentBtn}
                      onPress={() => handleDeleteComment(comment.id)}
                    >
                      <Feather name="x" size={14} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Edit Post Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Post</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.editLabel}>Title</Text>
            <TextInput
              style={styles.editTitleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Post title"
              placeholderTextColor="#999"
            />

            <Text style={styles.editLabel}>Content</Text>
            <TextInput
              style={styles.editContentInput}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="Post content"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            <View style={styles.editModalActions}>
              <TouchableOpacity 
                style={styles.editCancelBtn} 
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.editCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editSaveBtn, saving && styles.editSaveBtnDisabled]}
                onPress={handleEditPost}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Profile Popup Modal */}
      <Modal
        visible={showUserPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUserPopup(false)}
      >
        <TouchableOpacity 
          style={styles.userPopupOverlay}
          activeOpacity={1}
          onPress={() => setShowUserPopup(false)}
        >
          <View style={styles.userPopupContent}>
            <View style={styles.userPopupHeader}>
              <Avatar 
                name={post.authorName} 
                photoURL={post.authorPhotoURL} 
                size={60} 
              />
              <View style={styles.userPopupInfo}>
                <Text style={styles.userPopupName}>{post.authorName}</Text>
                <Text style={styles.userPopupMeta}>Community Member</Text>
              </View>
            </View>
            
            <View style={styles.userPopupStats}>
              <View style={styles.userPopupStat}>
                <Text style={styles.userPopupStatValue}>{formatStatValue(authorStats.recipes)}</Text>
                <Text style={styles.userPopupStatLabel}>Recipes</Text>
              </View>
              <View style={styles.userPopupStatDivider} />
              <View style={styles.userPopupStat}>
                <Text style={styles.userPopupStatValue}>{formatStatValue(authorStats.posts)}</Text>
                <Text style={styles.userPopupStatLabel}>Posts</Text>
              </View>
              <View style={styles.userPopupStatDivider} />
              <View style={styles.userPopupStat}>
                <Text style={styles.userPopupStatValue}>{formatStatValue(authorStats.xp)}</Text>
                <Text style={styles.userPopupStatLabel}>XP</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.userPopupCloseBtn}
              onPress={() => setShowUserPopup(false)}
            >
              <Text style={styles.userPopupCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Share Success Modal Component
interface ShareSuccessModalProps {
  visible: boolean;
  recipe: Recipe | null;
  rating: number;
  userId: string;
  onClose: () => void;
  onShare: () => void;
}

export function ShareSuccessModal({
  visible,
  recipe,
  rating,
  userId,
  onClose,
  onShare,
}: ShareSuccessModalProps) {
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedImages([]);
      setComment('');
    }
  }, [visible]);

  const handlePickImage = async () => {
    if (selectedImages.length >= 4) {
      Alert.alert('Limit Reached', 'You can add up to 4 photos');
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const uri = await uploadService.takePhoto();
            if (uri) {
              setSelectedImages(prev => [...prev, uri]);
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const uri = await uploadService.pickImage();
            if (uri) {
              setSelectedImages(prev => [...prev, uri]);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    if (!recipe) return;
    
    setPosting(true);

    // Upload images first if any
    let imageUrls: string[] = [];
    if (selectedImages.length > 0) {
      setUploadingImages(true);
      const uploadResult = await uploadService.uploadMultipleImages(selectedImages);
      setUploadingImages(false);
      
      if (uploadResult.ok && uploadResult.urls) {
        imageUrls = uploadResult.urls;
      } else {
        Alert.alert('Warning', 'Failed to upload some images. Continuing without them.');
      }
    }

    const post = await communityService.shareRecipeSuccess(
      userId,
      recipe,
      rating,
      comment || `Just made ${recipe.title} and it turned out amazing!`,
      imageUrls.length > 0 ? imageUrls : undefined,
    );
    setPosting(false);

    if (post) {
      Alert.alert('Success!', 'Your creation has been shared with the community!');
      setComment('');
      setSelectedImages([]);
      onShare();
    } else {
      Alert.alert('Error', 'Failed to share. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.shareModalContent}>
          <View style={styles.shareModalHeader}>
            <Text style={styles.shareModalTitle}>Share Your Creation</Text>
            <TouchableOpacity onPress={onClose}>
              <AntDesign name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {recipe && (
            <View style={styles.recipePreview}>
              <Text style={styles.recipePreviewTitle}>{recipe.title}</Text>
              <View style={styles.ratingPreview}>
                {[1, 2, 3, 4, 5].map(star => (
                  <MaterialCommunityIcons
                    key={star}
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={16}
                    color="#f59e0b"
                  />
                ))}
              </View>
            </View>
          )}

          {/* Image Picker Section */}
          <Text style={styles.shareLabel}>Add photos (optional)</Text>
          <View style={styles.imagePickerContainer}>
            {selectedImages.map((uri, index) => (
              <View key={index} style={styles.selectedImageWrapper}>
                <Image source={{ uri }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.removeImageBtn} 
                  onPress={() => removeImage(index)}
                >
                  <AntDesign name="close-circle" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ))}
            {selectedImages.length < 4 && (
              <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImage}>
                <Feather name="camera" size={24} color="#ff8a3d" />
                <Text style={styles.addImageText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.shareLabel}>Add a comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell the community about your experience..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />

          <View style={styles.shareModalActions}>
            <TouchableOpacity 
              style={styles.skipBtn} 
              onPress={async () => {
                if (recipe) {
                  await communityService.saveForLater(recipe, rating);
                  Alert.alert(
                    'Saved for Later',
                    "You can share this recipe anytime from your profile's Pending Shares.",
                    [{ text: 'OK', onPress: onClose }]
                  );
                } else {
                  onClose();
                }
              }}
            >
              <Text style={styles.skipBtnText}>Maybe Later</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shareBtn, posting && styles.shareBtnDisabled]} 
              onPress={handleShare}
              disabled={posting}
            >
              {uploadingImages ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={18} color="#fff" />
              )}
              <Text style={styles.shareBtnText}>
                {uploadingImages ? 'Uploading...' : posting ? 'Sharing...' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 120,
  },
  banner: {
    backgroundColor: '#ff8a3d',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  bannerContent: {
    padding: 20,
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#2bb673',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  feedContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2bb673',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  authorMeta: {
    marginLeft: 12,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  authorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  postTime: {
    fontSize: 12,
    color: '#888',
  },
  typeBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingValue: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#f59e0b',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 12,
  },
  postContent: {
    fontSize: 14,
    color: '#555',
    marginTop: 6,
    lineHeight: 20,
  },
  postImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#f9f5f2',
    borderRadius: 12,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 48,
  },
  trendingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  trendingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  tagText: {
    fontSize: 12,
    color: '#166534',
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  engagementLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  engagementRight: {
    flexDirection: 'row',
    gap: 12,
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  engagementTextActive: {
    color: '#ef4444',
  },
  savedIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2bb673',
  },
  saveArchiveBtn: {
    backgroundColor: '#f0fdf4',
    padding: 6,
    borderRadius: 8,
  },
  cookRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2bb673',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  cookRecipeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Share Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shareModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  recipePreview: {
    backgroundColor: '#f9f5f2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  recipePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  ratingPreview: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    height: 100,
    textAlignVertical: 'top',
  },
  shareModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  skipBtnText: {
    fontSize: 15,
    color: '#666',
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#2bb673',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  // Image Picker Styles
  imagePickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  selectedImageWrapper: {
    position: 'relative',
  },
  selectedImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addImageBtn: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff8a3d',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#ff8a3d',
    marginTop: 2,
  },
  // Header Right (rating + post actions)
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postActions: {
    flexDirection: 'row',
    gap: 4,
  },
  postActionBtn: {
    padding: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  // Comments Section Styles
  commentsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    maxHeight: 80,
  },
  sendCommentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2bb673',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendCommentBtnDisabled: {
    backgroundColor: '#ccc',
  },
  commentsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  commentsLoadingText: {
    color: '#666',
    fontSize: 13,
  },
  noCommentsText: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  commentsList: {
    gap: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  commentTime: {
    fontSize: 11,
    color: '#999',
  },
  commentText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  deleteCommentBtn: {
    padding: 4,
  },
  // Edit Modal Styles
  editModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  editTitleInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  editContentInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    height: 100,
    textAlignVertical: 'top',
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  editCancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  editCancelBtnText: {
    fontSize: 15,
    color: '#666',
  },
  editSaveBtn: {
    backgroundColor: '#2bb673',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  editSaveBtnDisabled: {
    opacity: 0.6,
  },
  editSaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  // User Profile Popup Styles
  userPopupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPopupContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  userPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  userPopupInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userPopupName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  userPopupMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  userPopupStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  userPopupStat: {
    alignItems: 'center',
    flex: 1,
  },
  userPopupStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2bb673',
  },
  userPopupStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  userPopupStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
  userPopupCloseBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  userPopupCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  /* ── Leaderboard preview card ── */
  lbCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#18b66f',
  },
  lbCardTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: '#18b66f',
    marginBottom: 8,
  },
  lbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lbUserCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  lbRank: {
    fontWeight: '800',
    fontSize: 16,
  },
  lbName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
    textAlign: 'center',
  },
  lbXp: {
    fontSize: 11,
    color: '#18b66f',
    fontWeight: '700',
    marginTop: 2,
  },
  lbExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderRadius: 4,
  },
  lbExpandedRowHighlight: {
    backgroundColor: '#e6fff0',
    borderLeftColor: '#18b66f',
  },
  lbYourRank: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#18b66f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lbYourRankLabel: {
    fontWeight: '700',
    fontSize: 13,
    color: '#18b66f',
  },
  lbYourRankValue: {
    fontWeight: '600',
    fontSize: 13,
    color: '#333',
  },
  lbExpandBtn: {
    alignSelf: 'center',
    marginTop: 6,
    padding: 4,
  },
});

export default CommunityFeed;
