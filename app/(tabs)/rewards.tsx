// app/(tabs)/rewards.tsx
// Rewards screen with 3-tier rewards system

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import userStatsService, { UserStats, XP_REWARDS } from '../../services/user-stats.service';

// Weekly Goals for Tier 2
interface WeeklyGoal {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  xpReward: number;
  icon: string;
  type: 'recipes' | 'shares' | 'ingredients' | 'streak';
}

// Tier 1 instant rewards data
const INSTANT_REWARDS = [
  { action: 'Complete a recipe', xp: XP_REWARDS.COMPLETE_RECIPE, icon: 'checkmark-circle' },
  { action: 'Share your creation', xp: XP_REWARDS.SHARE_CREATION, icon: 'share-social' },
  { action: 'Try a new ingredient', xp: XP_REWARDS.TRY_NEW_INGREDIENT, icon: 'leaf' },
  { action: 'Comment on community post', xp: XP_REWARDS.COMMUNITY_COMMENT, icon: 'chatbubble' },
  { action: 'Daily cooking streak', xp: XP_REWARDS.DAILY_STREAK, icon: 'flame' },
  { action: 'Rate a recipe', xp: XP_REWARDS.RATE_RECIPE, icon: 'star' },
];

// Coming Soon rewards for Tier 3
const COMING_SOON_REWARDS = [
  { title: 'Partner Discounts', description: 'Save on kitchen tools & ingredients from partner brands', icon: 'gift' },
  { title: 'Recipe Book Export', description: 'Export your recipes to a printable cookbook', icon: 'book' },
  { title: 'Premium Ingredients', description: 'Win specialty ingredients delivered to your door', icon: 'nutrition' },
  { title: 'Cooking Classes', description: 'Free access to online cooking masterclasses', icon: 'videocam' },
];

export default function RewardsScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);

  const loadData = useCallback(async () => {
    try {
      const userStats = await userStatsService.loadStats();
      setStats(userStats);
    } catch (error) {
      console.error('Error loading rewards data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Calculate weekly goals based on stats
  const getWeeklyGoals = (): WeeklyGoal[] => {
    if (!stats) return [];
    
    return [
      {
        id: 'weekly-recipes',
        title: 'Chef in Training',
        description: 'Complete 3 recipes this week',
        current: Math.min(stats.recipesCompleted % 3, 3), // Reset weekly
        target: 3,
        xpReward: 50,
        icon: 'restaurant',
        type: 'recipes',
      },
      {
        id: 'weekly-shares',
        title: 'Community Star',
        description: 'Share 2 recipes with the community',
        current: Math.min(stats.recipesShared % 2, 2),
        target: 2,
        xpReward: 30,
        icon: 'people',
        type: 'shares',
      },
      {
        id: 'weekly-ingredients',
        title: 'Ingredient Explorer',
        description: 'Try 5 new ingredients',
        current: Math.min(stats.uniqueIngredients.length % 5, 5),
        target: 5,
        xpReward: 40,
        icon: 'leaf',
        type: 'ingredients',
      },
      {
        id: 'weekly-streak',
        title: 'Consistency King',
        description: 'Maintain a 7-day cooking streak',
        current: Math.min(stats.currentStreak, 7),
        target: 7,
        xpReward: 75,
        icon: 'flame',
        type: 'streak',
      },
    ];
  };

  // Calculate XP progress to next level
  const getXPProgress = () => {
    if (!stats) return { current: 0, next: 100, progress: 0 };
    
    const levels = [
      { level: 'Beginner', minXP: 0 },
      { level: 'Novice Cook', minXP: 200 },
      { level: 'Home Chef', minXP: 500 },
      { level: 'Skilled Chef', minXP: 1000 },
      { level: 'Expert Chef', minXP: 2000 },
      { level: 'Master Chef', minXP: 5000 },
      { level: 'Culinary Legend', minXP: 10000 },
    ];
    
    const currentLevelIndex = levels.findIndex(l => l.level === stats.level);
    const nextLevel = levels[currentLevelIndex + 1];
    
    if (!nextLevel) {
      return { current: stats.xp, next: stats.xp, progress: 1, nextLevel: 'Max Level!' };
    }
    
    const currentLevelXP = levels[currentLevelIndex].minXP;
    const xpInCurrentLevel = stats.xp - currentLevelXP;
    const xpNeededForNext = nextLevel.minXP - currentLevelXP;
    
    return {
      current: xpInCurrentLevel,
      next: xpNeededForNext,
      progress: xpInCurrentLevel / xpNeededForNext,
      nextLevel: nextLevel.level,
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2bb673" />
        <Text style={styles.loadingText}>Loading rewards...</Text>
      </View>
    );
  }

  const xpProgress = getXPProgress();
  const weeklyGoals = getWeeklyGoals();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Rewards</Text>
        <View style={styles.xpBadge}>
          <Ionicons name="star" size={16} color="#f59e0b" />
          <Text style={styles.xpBadgeText}>{stats?.xp || 0} XP</Text>
        </View>
      </View>

      {/* Level Progress Card */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelTitle}>{stats?.level || 'Beginner'}</Text>
          <Text style={styles.levelNext}>
            {xpProgress.nextLevel ? `→ ${xpProgress.nextLevel}` : ''}
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${xpProgress.progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {xpProgress.current} / {xpProgress.next} XP
        </Text>
      </View>

      {/* Tier Tabs */}
      <View style={styles.tierTabs}>
        <TouchableOpacity
          style={[styles.tierTab, selectedTier === 1 && styles.tierTabActive]}
          onPress={() => setSelectedTier(1)}
        >
          <Ionicons name="flash" size={18} color={selectedTier === 1 ? '#fff' : '#666'} />
          <Text style={[styles.tierTabText, selectedTier === 1 && styles.tierTabTextActive]}>
            Instant
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tierTab, selectedTier === 2 && styles.tierTabActive]}
          onPress={() => setSelectedTier(2)}
        >
          <Ionicons name="trophy" size={18} color={selectedTier === 2 ? '#fff' : '#666'} />
          <Text style={[styles.tierTabText, selectedTier === 2 && styles.tierTabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tierTab, selectedTier === 3 && styles.tierTabActive]}
          onPress={() => setSelectedTier(3)}
        >
          <Ionicons name="gift" size={18} color={selectedTier === 3 ? '#fff' : '#666'} />
          <Text style={[styles.tierTabText, selectedTier === 3 && styles.tierTabTextActive]}>
            Coming Soon
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2bb673']} />
        }
      >
        {/* Tier 1: Instant Rewards */}
        {selectedTier === 1 && (
          <View style={styles.tierContent}>
            <Text style={styles.tierDescription}>
              Earn XP instantly for every action you take!
            </Text>
            {INSTANT_REWARDS.map((reward, index) => (
              <View key={index} style={styles.instantRewardCard}>
                <View style={styles.instantRewardIcon}>
                  <Ionicons name={reward.icon as any} size={24} color="#2bb673" />
                </View>
                <View style={styles.instantRewardInfo}>
                  <Text style={styles.instantRewardAction}>{reward.action}</Text>
                </View>
                <View style={styles.instantRewardXP}>
                  <Text style={styles.xpValue}>+{reward.xp}</Text>
                  <Text style={styles.xpLabel}>XP</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tier 2: Weekly Goals */}
        {selectedTier === 2 && (
          <View style={styles.tierContent}>
            <Text style={styles.tierDescription}>
              Complete weekly challenges for bonus XP!
            </Text>
            {weeklyGoals.map((goal) => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalIconContainer}>
                    <Ionicons name={goal.icon as any} size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalDescription}>{goal.description}</Text>
                  </View>
                  <View style={styles.goalReward}>
                    <Text style={styles.goalXP}>+{goal.xpReward}</Text>
                    <Text style={styles.goalXPLabel}>XP</Text>
                  </View>
                </View>
                <View style={styles.goalProgressContainer}>
                  <View style={styles.goalProgressBar}>
                    <View 
                      style={[
                        styles.goalProgressFill, 
                        { width: `${(goal.current / goal.target) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.goalProgressText}>
                    {goal.current} / {goal.target}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tier 3: Coming Soon */}
        {selectedTier === 3 && (
          <View style={styles.tierContent}>
            <Text style={styles.tierDescription}>
              Exciting real-world rewards are on the way!
            </Text>
            {COMING_SOON_REWARDS.map((reward, index) => (
              <View key={index} style={styles.comingSoonCard}>
                <View style={styles.comingSoonIcon}>
                  <Ionicons name={reward.icon as any} size={28} color="#8b5cf6" />
                </View>
                <View style={styles.comingSoonInfo}>
                  <Text style={styles.comingSoonTitle}>{reward.title}</Text>
                  <Text style={styles.comingSoonDescription}>{reward.description}</Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>SOON</Text>
                </View>
              </View>
            ))}
            
            <View style={styles.teaser}>
              <Ionicons name="sparkles" size={32} color="#f59e0b" />
              <Text style={styles.teaserText}>
                Keep cooking and earning XP! Real rewards are almost here.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2bb673',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  xpBadgeText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 14,
  },
  levelCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2bb673',
  },
  levelNext: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#e5e5e5',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2bb673',
    borderRadius: 6,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
  },
  tierTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tierTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tierTabActive: {
    backgroundColor: '#2bb673',
  },
  tierTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tierTabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  tierContent: {
    padding: 16,
  },
  tierDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  
  // Tier 1 styles
  instantRewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  instantRewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instantRewardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  instantRewardAction: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  instantRewardXP: {
    alignItems: 'center',
  },
  xpValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  xpLabel: {
    fontSize: 10,
    color: '#999',
  },
  
  // Tier 2 styles
  goalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  goalDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  goalReward: {
    alignItems: 'center',
  },
  goalXP: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2bb673',
  },
  goalXPLabel: {
    fontSize: 10,
    color: '#999',
  },
  goalProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  goalProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 40,
    textAlign: 'right',
  },
  
  // Tier 3 styles
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
  },
  comingSoonIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonInfo: {
    flex: 1,
    marginLeft: 12,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  comingSoonDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  teaser: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
  },
  teaserText: {
    marginTop: 12,
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '500',
  },
});
