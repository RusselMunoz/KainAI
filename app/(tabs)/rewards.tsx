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
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useUser, UserStats } from '../../contexts/UserContext';
import { XP_REWARDS as ACTION_REWARD_POINTS } from '../../services/user-stats.service';

// Weekly goal targets
const WEEKLY_GOAL_TARGETS = {
  recipesCooked: 3,
  newIngredientsTried: 5,
  creationsShared: 2,
};

// Points awarded per goal completion
const GOAL_REWARD_POINTS = 50;

// Weekly Goals for Tier 2
interface WeeklyGoal {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  rewardPoints: number;
  icon: string;
  type: 'recipes' | 'shares' | 'ingredients' | 'streak';
  completed: boolean;
}

// Tier 1 instant rewards data
const INSTANT_REWARDS = [
  { action: 'Complete a recipe', points: ACTION_REWARD_POINTS.COMPLETE_RECIPE, icon: 'checkmark-circle' },
  { action: 'Share your creation', points: ACTION_REWARD_POINTS.SHARE_CREATION, icon: 'share-social' },
  { action: 'Try a new ingredient', points: ACTION_REWARD_POINTS.TRY_NEW_INGREDIENT, icon: 'leaf' },
  { action: 'Comment on community post', points: ACTION_REWARD_POINTS.COMMUNITY_COMMENT, icon: 'chatbubble' },
  { action: 'Daily cooking streak', points: ACTION_REWARD_POINTS.DAILY_STREAK, icon: 'flame' },
  { action: 'Rate a recipe', points: ACTION_REWARD_POINTS.RATE_RECIPE, icon: 'star' },
];

// Coming Soon rewards for Tier 3
const COMING_SOON_REWARDS = [
  { title: 'Partner Discounts', description: 'Save on kitchen tools & ingredients from partner brands', icon: 'gift' },
  { title: 'Recipe Book Export', description: 'Export your recipes to a printable cookbook', icon: 'book' },
  { title: 'Premium Ingredients', description: 'Win specialty ingredients delivered to your door', icon: 'nutrition' },
  { title: 'Cooking Classes', description: 'Free access to online cooking masterclasses', icon: 'videocam' },
];

export default function RewardsScreen() {
  const router = useRouter();
  const { stats, updateStats, refreshStats, loading } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);
  const [showDebug, setShowDebug] = useState(false); // Keep debug panel inaccessible unless manually re-enabled in code

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshStats();
    setRefreshing(false);
  }, [refreshStats]);

  // Calculate weekly goals based on stats from context
  const getWeeklyGoals = (): WeeklyGoal[] => {
    const goals = stats.weeklyGoals;
    const completedGoals = goals.goalsCompletedThisWeek || [];
    
    return [
      {
        id: 'weekly-recipes',
        title: 'Chef in Training',
        description: 'Complete 3 recipes this week',
        current: goals.recipesCooked,
        target: WEEKLY_GOAL_TARGETS.recipesCooked,
        rewardPoints: GOAL_REWARD_POINTS,
        icon: 'restaurant',
        type: 'recipes',
        completed: completedGoals.includes('weekly-recipes'),
      },
      {
        id: 'weekly-shares',
        title: 'Community Star',
        description: 'Share 2 recipes with the community',
        current: goals.creationsShared,
        target: WEEKLY_GOAL_TARGETS.creationsShared,
        rewardPoints: GOAL_REWARD_POINTS,
        icon: 'people',
        type: 'shares',
        completed: completedGoals.includes('weekly-shares'),
      },
      {
        id: 'weekly-ingredients',
        title: 'Ingredient Explorer',
        description: 'Try 5 new ingredients',
        current: goals.newIngredientsTried,
        target: WEEKLY_GOAL_TARGETS.newIngredientsTried,
        rewardPoints: GOAL_REWARD_POINTS,
        icon: 'leaf',
        type: 'ingredients',
        completed: completedGoals.includes('weekly-ingredients'),
      },
    ];
  };

  // Debug: Complete a weekly goal
  const debugCompleteGoal = async (goalId: string, goalType: string) => {
    const goals = stats.weeklyGoals;
    const completedGoals = [...(goals.goalsCompletedThisWeek || [])];
    
    if (completedGoals.includes(goalId)) {
      Alert.alert('Already Completed', 'This goal was already completed this week.');
      return;
    }
    
    // Set progress to target based on goal type
    const updatedGoals = { ...goals };
    if (goalType === 'recipes') {
      updatedGoals.recipesCooked = WEEKLY_GOAL_TARGETS.recipesCooked;
    } else if (goalType === 'shares') {
      updatedGoals.creationsShared = WEEKLY_GOAL_TARGETS.creationsShared;
    } else if (goalType === 'ingredients') {
      updatedGoals.newIngredientsTried = WEEKLY_GOAL_TARGETS.newIngredientsTried;
    }
    
    // Mark as completed and award points
    completedGoals.push(goalId);
    updatedGoals.goalsCompletedThisWeek = completedGoals;
    
    const newRewardPoints = stats.rewardPoints + GOAL_REWARD_POINTS;
    
    await updateStats({ 
      weeklyGoals: updatedGoals,
      rewardPoints: newRewardPoints,
    });
    
    Alert.alert('🎉 Goal Completed!', `+${GOAL_REWARD_POINTS} reward points earned!`);
  };

  // Debug: Reset a weekly goal's progress
  const debugResetGoal = async (goalType: string) => {
    const goals = { ...stats.weeklyGoals };
    
    if (goalType === 'recipes') {
      goals.recipesCooked = 0;
    } else if (goalType === 'shares') {
      goals.creationsShared = 0;
    } else if (goalType === 'ingredients') {
      goals.newIngredientsTried = 0;
    }
    
    // Remove from completed list
    goals.goalsCompletedThisWeek = (goals.goalsCompletedThisWeek || []).filter(
      id => !id.includes(goalType.slice(0, 4))
    );
    
    await updateStats({ weeklyGoals: goals });
    Alert.alert('Reset', 'Goal progress has been reset.');
  };

  // Debug: Reset all weekly goals
  const debugResetAllGoals = async () => {
    Alert.alert(
      'Reset All Goals?',
      'This will reset all weekly goal progress. Points already earned will not be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            await updateStats({
              weeklyGoals: {
                recipesCooked: 0,
                newIngredientsTried: 0,
                creationsShared: 0,
                goalsCompletedThisWeek: [],
                lastResetDate: new Date().toISOString(),
              },
            });
            Alert.alert('Reset', 'All weekly goals have been reset.');
          },
        },
      ]
    );
  };

  // Calculate XP progress to next level
  const getXPProgress = () => {
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 Rewards</Text>
        <View style={styles.xpBadge}>
          <Ionicons name="gift" size={16} color="#f59e0b" />
          <Text style={styles.xpBadgeText}>{stats.rewardPoints} pts</Text>
        </View>
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
              Earn reward points instantly for every action you take!
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
                  <Text style={styles.xpValue}>+{reward.points}</Text>
                  <Text style={styles.xpLabel}>PTS</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tier 2: Weekly Goals */}
        {selectedTier === 2 && (
          <View style={styles.tierContent}>
            <Text style={styles.tierDescription}>
              Complete weekly challenges for bonus reward points!
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
                    <Text style={styles.goalXP}>+{goal.rewardPoints}</Text>
                    <Text style={styles.goalXPLabel}>PTS</Text>
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
                Keep cooking and earning reward points! Real rewards are almost here.
              </Text>
            </View>
          </View>
        )}

        {/* Debug Panel - Only visible in DEV mode */}
        {__DEV__ && showDebug && (
          <View style={styles.debugPanel}>
            <View style={styles.debugHeader}>
              <Feather name="cpu" size={18} color="#e74c3c" />
              <Text style={styles.debugTitle}>Debug: Weekly Goals</Text>
              <TouchableOpacity onPress={() => setShowDebug(false)}>
                <Feather name="x" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            
            {weeklyGoals.map((goal) => (
              <View key={`debug-${goal.id}`} style={styles.debugGoalRow}>
                <View style={styles.debugGoalInfo}>
                  <Text style={styles.debugGoalTitle}>{goal.title}</Text>
                  <Text style={styles.debugGoalProgress}>
                    Progress: {goal.current}/{goal.target}
                    {goal.completed && ' ✅'}
                  </Text>
                </View>
                <View style={styles.debugBtnRow}>
                  <TouchableOpacity 
                    style={[styles.debugBtn, styles.debugBtnGreen]}
                    onPress={() => debugCompleteGoal(goal.id, goal.type)}
                  >
                    <Text style={styles.debugBtnText}>Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.debugBtn, styles.debugBtnRed]}
                    onPress={() => debugResetGoal(goal.type)}
                  >
                    <Text style={styles.debugBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            <TouchableOpacity 
              style={styles.debugResetAllBtn}
              onPress={debugResetAllGoals}
            >
              <Text style={styles.debugResetAllText}>Reset All Weekly Goals</Text>
            </TouchableOpacity>
            
            <Text style={styles.debugNote}>
              Current Reward Points: {stats.rewardPoints}
            </Text>
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginLeft: 12,
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
    marginTop: 20,
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
  
  // Debug Panel styles
  debugPanel: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  debugTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#e74c3c',
  },
  debugGoalRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  debugGoalInfo: {
    marginBottom: 8,
  },
  debugGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  debugGoalProgress: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  debugBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  debugBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  debugBtnGreen: {
    backgroundColor: '#22c55e',
  },
  debugBtnRed: {
    backgroundColor: '#ef4444',
  },
  debugBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  debugResetAllBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  debugResetAllText: {
    color: '#fff',
    fontWeight: '700',
  },
  debugNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
