// app/(tabs)/debug.tsx - Comprehensive Debug Tools for KainAI
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../contexts/UserContext';
import { XP_REWARDS } from '../../services/user-stats.service';
import communityService from '../../services/community.service';
import type { CommunityPost } from '../../types';

// Storage keys
const STATS_KEY = '@kainai_user_stats';
const PROFILE_KEY = '@cheffy_user_profile';

// Level thresholds for calculating level from XP
const LEVEL_THRESHOLDS = [
  { level: 'Beginner', minXP: 0 },
  { level: 'Novice Cook', minXP: 200 },
  { level: 'Home Chef', minXP: 500 },
  { level: 'Skilled Chef', minXP: 1000 },
  { level: 'Expert Chef', minXP: 2000 },
  { level: 'Master Chef', minXP: 5000 },
  { level: 'Culinary Legend', minXP: 10000 },
];

const calculateLevel = (xp: number): string => {
  let level = 'Beginner';
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold.minXP) {
      level = threshold.level;
    } else {
      break;
    }
  }
  return level;
};

export default function DebugScreen() {
  const router = useRouter();
  const { profile, stats, updateProfile, updateStats, refreshStats } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  
  // Profile override state
  const [editDisplayName, setEditDisplayName] = useState(profile.displayName);
  const [editPhotoURL, setEditPhotoURL] = useState(profile.photoURL || '');
  const [editCookingLevel, setEditCookingLevel] = useState(profile.cookingLevel);
  
  // Community posts state
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<string | null>('xp');

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    setEditDisplayName(profile.displayName);
    setEditPhotoURL(profile.photoURL || '');
    setEditCookingLevel(profile.cookingLevel);
  }, [profile]);

  const loadPosts = async () => {
    setLoadingPosts(true);
    try {
      const feedPosts = await communityService.getFeedPosts('all', 20);
      setPosts(feedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
    setLoadingPosts(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshStats(), loadPosts()]);
    setRefreshing(false);
  }, [refreshStats]);

  // XP Management - Uses UserContext for instant sync across all screens
  const modifyXP = async (amount: number) => {
    try {
      const newXP = Math.max(0, stats.xp + amount);
      const newLevel = calculateLevel(newXP);
      
      // Update via context - this triggers re-renders in all subscribed components
      await updateStats({ xp: newXP, level: newLevel });
      Alert.alert('XP Updated', `${amount > 0 ? '+' : ''}${amount} XP → Total: ${newXP} XP`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update XP');
    }
  };

  const resetXP = async () => {
    Alert.alert(
      'Reset XP?',
      'This will set your XP to 0 and reset your level to Beginner.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateStats({ xp: 0, level: 'Beginner' });
              Alert.alert('XP Reset', 'XP has been reset to 0');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset XP');
            }
          },
        },
      ]
    );
  };

  // Reward Points Management - Uses UserContext for instant sync
  const modifyRewardPoints = async (amount: number) => {
    try {
      const newPoints = Math.max(0, stats.rewardPoints + amount);
      await updateStats({ rewardPoints: newPoints });
      Alert.alert('Points Updated', `${amount > 0 ? '+' : ''}${amount} pts → Total: ${newPoints} pts`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update reward points');
    }
  };

  const resetRewardPoints = async () => {
    Alert.alert(
      'Reset Reward Points?',
      'This will set your reward points to 0.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateStats({ rewardPoints: 0 });
              Alert.alert('Points Reset', 'Reward points have been reset to 0');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset reward points');
            }
          },
        },
      ]
    );
  };

  // Profile Management
  const applyProfileChanges = async () => {
    try {
      await updateProfile({
        displayName: editDisplayName,
        photoURL: editPhotoURL || null,
        cookingLevel: editCookingLevel,
      });
      Alert.alert('Profile Updated', 'Changes applied successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Achievement Management
  const incrementRecipeCount = async (amount: number) => {
    try {
      const stored = await AsyncStorage.getItem(STATS_KEY);
      if (stored) {
        const parsedStats = JSON.parse(stored);
        parsedStats.recipesCompleted = Math.max(0, (parsedStats.recipesCompleted || 0) + amount);
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(parsedStats));
      }
      await loadStats();
      Alert.alert('Updated', `Recipe count ${amount > 0 ? 'increased' : 'decreased'} by ${Math.abs(amount)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update recipe count');
    }
  };

  const forceCompleteAchievement = async (achievementId: string) => {
    try {
      const stored = await AsyncStorage.getItem(STATS_KEY);
      if (stored) {
        const parsedStats = JSON.parse(stored);
        if (!parsedStats.achievementsCompleted) {
          parsedStats.achievementsCompleted = [];
        }
        if (!parsedStats.achievementsCompleted.includes(achievementId)) {
          parsedStats.achievementsCompleted.push(achievementId);
          parsedStats.xp = (parsedStats.xp || 0) + XP_REWARDS.COMPLETE_ACHIEVEMENT;
          parsedStats.level = userStatsService.calculateLevel(parsedStats.xp);
          await AsyncStorage.setItem(STATS_KEY, JSON.stringify(parsedStats));
        }
      }
      await loadStats();
      Alert.alert('Achievement Unlocked', `${achievementId} completed! +50 XP`);
    } catch (error) {
      Alert.alert('Error', 'Failed to complete achievement');
    }
  };

  // Post Management
  const deletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post?',
      'This will permanently delete this post.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use admin override (demo-user-id for demo mode)
              const success = await communityService.deletePost(postId, 'demo-user-id');
              if (success) {
                setPosts(prev => prev.filter(p => p.id !== postId));
                Alert.alert('Deleted', 'Post removed successfully');
              } else {
                Alert.alert('Error', 'Failed to delete post');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  // Storage Management
  const clearAllStorage = async () => {
    Alert.alert(
      'Clear All Data?',
      'This will clear all app data including profile, stats, and cached recipes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              await loadStats();
              Alert.alert('Cleared', 'All app data has been cleared. Restart the app for full effect.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear storage');
            }
          },
        },
      ]
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const SectionHeader = ({ title, icon, section }: { title: string; icon: string; section: string }) => (
    <Pressable 
      style={styles.sectionHeader}
      onPress={() => toggleSection(section)}
    >
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Feather 
        name={expandedSection === section ? 'chevron-up' : 'chevron-down'} 
        size={20} 
        color="#888" 
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>🧪 Debug Tools</Text>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={18} color="#2bb673" />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2bb673']} />
        }
      >
        {/* Current State Overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>Current State</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{stats.xp}</Text>
              <Text style={styles.overviewLabel}>XP</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{stats.level}</Text>
              <Text style={styles.overviewLabel}>Level</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{stats.recipesCompleted}</Text>
              <Text style={styles.overviewLabel}>Recipes</Text>
            </View>
          </View>
        </View>

        {/* XP Management Panel */}
        <SectionHeader title="XP Management" icon="⚡" section="xp" />
        {expandedSection === 'xp' && (
          <View style={styles.sectionContent}>
            <Text style={styles.currentValue}>Current XP: {stats.xp}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyXP(10)}>
                <Text style={styles.actionBtnText}>+10 XP</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyXP(50)}>
                <Text style={styles.actionBtnText}>+50 XP</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyXP(100)}>
                <Text style={styles.actionBtnText}>+100 XP</Text>
              </Pressable>
            </View>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionBtn, styles.redBtn]} onPress={() => modifyXP(-50)}>
                <Text style={styles.actionBtnText}>-50 XP</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.redBtn]} onPress={resetXP}>
                <Text style={styles.actionBtnText}>Reset XP</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Level up at: 200 (Novice), 500 (Home Chef), 1000 (Skilled), 2000 (Expert)
            </Text>
          </View>
        )}

        {/* Reward Points Management Panel */}
        <SectionHeader title="Reward Points" icon="🪙" section="points" />
        {expandedSection === 'points' && (
          <View style={styles.sectionContent}>
            <Text style={styles.currentValue}>Current Points: {stats.rewardPoints}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyRewardPoints(5)}>
                <Text style={styles.actionBtnText}>+5 pts</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyRewardPoints(10)}>
                <Text style={styles.actionBtnText}>+10 pts</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => modifyRewardPoints(50)}>
                <Text style={styles.actionBtnText}>+50 pts</Text>
              </Pressable>
            </View>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionBtn, styles.redBtn]} onPress={() => modifyRewardPoints(-10)}>
                <Text style={styles.actionBtnText}>-10 pts</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.redBtn]} onPress={resetRewardPoints}>
                <Text style={styles.actionBtnText}>Reset Points</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Use reward points to redeem items in the Rewards store
            </Text>
          </View>
        )}

        {/* Profile Override Panel */}
        <SectionHeader title="Profile Override" icon="👤" section="profile" />
        {expandedSection === 'profile' && (
          <View style={styles.sectionContent}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.textInput}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
              placeholder="Enter display name"
              placeholderTextColor="#666"
            />
            
            <Text style={styles.inputLabel}>Profile Picture URL</Text>
            <TextInput
              style={styles.textInput}
              value={editPhotoURL}
              onChangeText={setEditPhotoURL}
              placeholder="https://example.com/photo.jpg"
              placeholderTextColor="#666"
            />
            
            <Text style={styles.inputLabel}>Cooking Skill</Text>
            <View style={styles.skillButtonRow}>
              {['Beginner', 'Intermediate', 'Advanced'].map(skill => (
                <Pressable 
                  key={skill}
                  style={[
                    styles.skillBtn, 
                    editCookingLevel === skill && styles.skillBtnActive
                  ]}
                  onPress={() => setEditCookingLevel(skill)}
                >
                  <Text style={[
                    styles.skillBtnText,
                    editCookingLevel === skill && styles.skillBtnTextActive
                  ]}>{skill}</Text>
                </Pressable>
              ))}
            </View>
            
            <Pressable style={[styles.actionBtn, styles.primaryBtn, styles.fullWidth]} onPress={applyProfileChanges}>
              <AntDesign name="check" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Apply Changes</Text>
            </Pressable>
          </View>
        )}

        {/* Achievement Debug Panel */}
        <SectionHeader title="Achievement Debug" icon="🏆" section="achievements" />
        {expandedSection === 'achievements' && (
          <View style={styles.sectionContent}>
            <Text style={styles.currentValue}>Recipes Completed: {stats.recipesCompleted}</Text>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => incrementRecipeCount(1)}>
                <Text style={styles.actionBtnText}>+1 Recipe</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.greenBtn]} onPress={() => incrementRecipeCount(5)}>
                <Text style={styles.actionBtnText}>+5 Recipes</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.redBtn]} onPress={() => incrementRecipeCount(-1)}>
                <Text style={styles.actionBtnText}>-1 Recipe</Text>
              </Pressable>
            </View>
            
            <Text style={styles.subsectionTitle}>Force Complete Achievement</Text>
            <View style={styles.achievementList}>
              {['first_recipe', 'ten_recipes', 'fifty_recipes', 'pro_chef', 'explorer'].map(achievement => (
                <Pressable 
                  key={achievement}
                  style={[
                    styles.achievementItem,
                    stats.achievementsCompleted.includes(achievement) && styles.achievementCompleted
                  ]}
                  onPress={() => forceCompleteAchievement(achievement)}
                >
                  <Text style={styles.achievementText}>{achievement}</Text>
                  {stats.achievementsCompleted.includes(achievement) && (
                    <AntDesign name="checkcircle" size={16} color="#2bb673" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Post Management Panel */}
        <SectionHeader title="Post Management" icon="📝" section="posts" />
        {expandedSection === 'posts' && (
          <View style={styles.sectionContent}>
            {loadingPosts ? (
              <ActivityIndicator color="#2bb673" />
            ) : posts.length === 0 ? (
              <Text style={styles.emptyText}>No posts found</Text>
            ) : (
              posts.slice(0, 10).map(post => (
                <View key={post.id} style={styles.postItem}>
                  <View style={styles.postInfo}>
                    <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                    <Text style={styles.postMeta}>by {post.authorName} • {post.type}</Text>
                  </View>
                  <Pressable 
                    style={styles.deleteBtn}
                    onPress={() => deletePost(post.id)}
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))
            )}
            {posts.length > 10 && (
              <Text style={styles.helperText}>Showing first 10 of {posts.length} posts</Text>
            )}
          </View>
        )}

        {/* Storage Management */}
        <SectionHeader title="Storage Management" icon="💾" section="storage" />
        {expandedSection === 'storage' && (
          <View style={styles.sectionContent}>
            <Pressable 
              style={[styles.actionBtn, styles.redBtn, styles.fullWidth]} 
              onPress={clearAllStorage}
            >
              <Feather name="trash" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Clear All App Data</Text>
            </Pressable>
            <Text style={styles.helperText}>
              This clears AsyncStorage including profile, stats, and cached data.
            </Text>
          </View>
        )}

        {/* Screen Navigation (original functionality) */}
        <SectionHeader title="Screen Navigation" icon="🧭" section="navigation" />
        {expandedSection === 'navigation' && (
          <View style={styles.sectionContent}>
            {[
              { label: '🏠 Dashboard', route: '/' },
              { label: '⚙️ Settings', route: '/setting' },
              { label: '🔐 Login', route: '/Login' },
              { label: '👨‍🍳 Introduction', route: '/introduction' },
              { label: '💬 Chat', route: '/chat' },
            ].map((screen) => (
              <Pressable
                key={screen.route}
                style={styles.navButton}
                onPress={() => router.push(screen.route as any)}
              >
                <Text style={styles.navButtonText}>{screen.label}</Text>
                <Feather name="chevron-right" size={16} color="#666" />
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a3a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  container: { padding: 16, paddingBottom: 40 },
  
  // Overview Card
  overviewCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  overviewTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  overviewItem: {
    alignItems: 'center',
  },
  overviewValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  overviewLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 16,
    borderRadius: 12,
    marginBottom: 2,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    backgroundColor: '#252538',
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 12,
  },
  
  // Common
  currentValue: {
    color: '#2bb673',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  greenBtn: {
    backgroundColor: '#2bb673',
  },
  redBtn: {
    backgroundColor: '#ef4444',
  },
  primaryBtn: {
    backgroundColor: '#3b82f6',
  },
  fullWidth: {
    width: '100%',
    marginTop: 8,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Profile Panel
  inputLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  skillButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  skillBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  skillBtnActive: {
    backgroundColor: '#2bb673',
    borderColor: '#2bb673',
  },
  skillBtnText: {
    color: '#888',
    fontWeight: '500',
    fontSize: 12,
  },
  skillBtnTextActive: {
    color: '#fff',
  },
  
  // Achievement Panel
  subsectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  achievementList: {
    gap: 8,
  },
  achievementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  achievementCompleted: {
    borderColor: '#2bb673',
    backgroundColor: '#1a3a2a',
  },
  achievementText: {
    color: '#fff',
    fontSize: 14,
  },
  
  // Post Panel
  postItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  postInfo: {
    flex: 1,
  },
  postTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  postMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#3a2020',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  
  // Navigation
  navButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});
