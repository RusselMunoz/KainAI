import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

// Lazy load heavy components - only imported when needed
// This significantly reduces initial bundle parsing time
const ChatScreen = lazy(() => import('../chat').then(m => ({ default: m.ChatScreen })));
const RecipeDetail = lazy(() => import('../../components/RecipeDetail'));
const CommunityFeed = lazy(() => import('../../components/CommunityFeed').then(m => ({ default: m.CommunityFeed })));
const ShareSuccessModal = lazy(() => import('../../components/CommunityFeed').then(m => ({ default: m.ShareSuccessModal })));

// Lightweight components loaded immediately
import Avatar from '../../components/Avatar';
import recipeService from '../../services/recipe.service';
import userStatsService from '../../services/user-stats.service';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Recipe, TabName } from '../../types';

// Loading fallback for lazy components
const LoadingFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#f59e0b" />
  </View>
);

const TABS = ['Chat', 'Recipes', 'Community', 'Awards'];
const screenW = Dimensions.get('window').width;

// top inset so header won't overlap status HUD
const topInset = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 12 : 12;
const composerHeight = 66; // used for bottom padding so content isn't hidden

// Fallback user ID for demo mode (when not authenticated)
const DEMO_USER_ID_FALLBACK = 'demo-user-id';

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabName>('Chat');
  
  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeDetail, setShowRecipeDetail] = useState(false);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [completedRecipe, setCompletedRecipe] = useState<Recipe | null>(null);
  const [completedRating, setCompletedRating] = useState(0);
  
  // User state - using global context for instant sync across screens
  const { profile, stats, updateStats } = useUser();
  const { user } = useAuth();
  
  // Use actual Firebase UID from auth, fallback to demo mode if not authenticated
  const userId = user?.uid || DEMO_USER_ID_FALLBACK;
  
  // Derived values from context - these update instantly when debug changes them
  const userXP = stats.xp;
  const userLevel = stats.level;
  const rewardPoints = stats.rewardPoints;
  const greetingName = profile.displayName?.trim() || user?.displayName || 'User';

  // Load recipes when switching to Recipes tab
  useEffect(() => {
    if (tab === 'Recipes') {
      loadRecipes();
    }
  }, [tab]);

  const loadRecipes = async () => {
    try {
      const userRecipes = await recipeService.getUserRecipes(userId);
      setRecipes(userRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  // Handle recipe generation from chat - switch to Recipes tab
  const handleRecipeGenerated = useCallback((recipeId: string) => {
    setTab('Recipes');
    loadRecipes();
  }, []);

  // Handle recipe completion - show share modal and award XP
  const handleRecipeComplete = useCallback(async (recipe: Recipe, rating: number) => {
    setCompletedRecipe(recipe);
    setCompletedRating(rating);
    setShowRecipeDetail(false);
    
    // Award XP for completing recipe
    try {
      const ingredients = recipe.ingredients?.map(ing => ing.name) || [];
      const result = await userStatsService.onRecipeComplete(ingredients);
      
      // Sync context with updated stats from service
      await updateStats({ 
        xp: result.newXP, 
        level: result.newLevel ?? stats.level,
        recipesCompleted: stats.recipesCompleted + 1,
      });
      
      // Show level up notification only if leveled up
      if (result.leveledUp && result.newLevel) {
        setTimeout(() => {
          Alert.alert(
            '🎉 Level Up!',
            `Congratulations! You're now a ${result.newLevel}!\n\n+${result.xpAwarded} XP earned`,
            [{ text: 'Awesome!' }]
          );
        }, 500);
      } else if (result.newAchievements && result.newAchievements.length > 0) {
        // Show achievement unlocked
        const achievementList = result.newAchievements.join('\n');
        Alert.alert(
          '🏆 Achievement Unlocked!',
          `${achievementList}\n\n+${result.xpAwarded} XP earned`,
          [{ text: 'Awesome!' }]
        );
      } else {
        // Just show XP earned
        Alert.alert(
          '✨ Recipe Complete!',
          `You earned +${result.xpAwarded} XP`,
          [{ text: 'Nice!' }]
        );
      }
    } catch (error) {
      console.error('Error awarding XP:', error);
    }
    
    // Brief delay before showing share prompt
    setTimeout(() => {
      setShowShareModal(true);
    }, 800);
  }, [stats, updateStats]);

  // Handle share completion - award bonus XP
  const handleShareComplete = useCallback(async () => {
    setShowShareModal(false);
    setCompletedRecipe(null);
    setTab('Community');
    
    // Award XP for sharing
    try {
      const result = await userStatsService.onShareCreation();
      // Sync context with updated stats
      await updateStats({ 
        xp: result.newXP,
        recipesShared: stats.recipesShared + 1,
      });
    } catch (error) {
      console.error('Error awarding share XP:', error);
    }
  }, [stats, updateStats]);

  // Open recipe detail
  const openRecipeDetail = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeDetail(true);
  };

  // FAB action - switch to chat for new recipe
  const handleFabPress = () => {
    setTab('Chat');
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar 
            name={profile.displayName} 
            photoURL={profile.photoURL} 
            size={48} 
          />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.hello}>Hello, {greetingName}!</Text>
            {/* XP under name - clickable to go to Awards tab */}
            <TouchableOpacity 
              style={styles.xpUnderName}
              onPress={() => setTab('Awards')}
              activeOpacity={0.7}
            >
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.xpUnderNameText}>{userXP} XP</Text>
            </TouchableOpacity>
            <Text style={styles.xpSmall}>{userLevel}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Reward Points Badge - tap to see rewards store */}
          <TouchableOpacity 
            style={styles.rewardPointsBadge}
            onPress={() => router.push('/rewards')}
          >
            <Text style={styles.rewardPointsEmoji}>🎁</Text>
            <Text style={styles.rewardPointsText}>{rewardPoints} pts</Text>
          </TouchableOpacity>
          {/* Debug button - remove in production */}
          <Pressable
            style={[styles.settings, { marginRight: 8, backgroundColor: '#e74c3c' }]}
            onPress={() => {
              router.push('/debug');
            }}>
            <Feather name="cpu" size={18} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.settings}
            onPress={() => {
              router.push('/setting');
            }}>
            <Feather name="settings" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabbar}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t as TabName)}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {t === 'Community' && <View/>}
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'Chat' && (
          <Suspense fallback={<LoadingFallback />}>
            <ChatScreen onRecipeGenerated={handleRecipeGenerated} />
          </Suspense>
        )}
        {tab === 'Recipes' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: composerHeight + 120 }]}> 
            <RecipesView 
              recipes={recipes} 
              onRecipePress={openRecipeDetail}
              onRefresh={loadRecipes}
            />
          </ScrollView>
        )}
        {tab === 'Community' && (
          <Suspense fallback={<LoadingFallback />}>
            <CommunityFeed
              userId={userId}
              onSharePress={() => {
                if (completedRecipe) {
                  setShowShareModal(true);
                } else {
                  Alert.alert(
                    'No Recipe to Share',
                    'Complete a recipe first, then you can share your creation!',
                    [{ text: 'OK' }]
                  );
                }
              }}
            />
          </Suspense>
        )}
        {tab === 'Awards' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: composerHeight + 120 }]}>
            <AwardsView userXP={userXP} userLevel={userLevel} rewardPoints={rewardPoints} recipesCompleted={recipes.filter(r => r.status === 'Done').length} />
          </ScrollView>
        )}
      </View>

      {/* FAB only for non-chat tabs */}
      {tab !== 'Chat' && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={handleFabPress}>
          <Text style={styles.fabText}>Generate{'\n'}Recipe</Text>
        </TouchableOpacity>
      )}

      {/* Recipe Detail Modal */}
      <Modal
        visible={showRecipeDetail}
        animationType="slide"
        onRequestClose={() => setShowRecipeDetail(false)}
      >
        <Suspense fallback={<LoadingFallback />}>
          {selectedRecipe && (
            <RecipeDetail
              recipe={selectedRecipe}
              userId={userId}
              onClose={() => {
                setShowRecipeDetail(false);
                loadRecipes(); // Refresh in case status changed
              }}
              onRecipeComplete={handleRecipeComplete}
            />
          )}
        </Suspense>
      </Modal>

      {/* Share Success Modal */}
      <Suspense fallback={null}>
        <ShareSuccessModal
          visible={showShareModal}
          recipe={completedRecipe}
          rating={completedRating}
          userId={userId}
          onClose={() => setShowShareModal(false)}
          onShare={handleShareComplete}
        />
      </Suspense>
    </View>
  );
}

/* --- Subviews --- */

interface RecipesViewProps {
  recipes: Recipe[];
  onRecipePress: (recipe: Recipe) => void;
  onRefresh: () => void;
}

function RecipesView({ recipes, onRecipePress, onRefresh }: RecipesViewProps) {
  if (recipes.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👨‍🍳</Text>
        <Text style={styles.emptyTitle}>No recipes yet</Text>
        <Text style={styles.emptySubtitle}>
          Start chatting with Cheffy to generate your first recipe!
        </Text>
      </View>
    );
  }

  return (
    <View>
      {recipes.map((recipe) => (
        <Pressable
          key={recipe.id}
          style={styles.recipeCard}
          onPress={() => onRecipePress(recipe)}
        >
          <View style={styles.recipeHeader}>
            <Text style={styles.recipeTitle}>{recipe.title}</Text>
            <View style={styles.ratingBox}>
              <Text style={styles.recipeRating}>★ {recipe.userRating || '4.8'}</Text>
              {recipe.status === 'Done' && (
                <View style={styles.doneIndicator}>
                  <AntDesign name="check-circle" size={14} color="#22c55e" />
                </View>
              )}
            </View>
          </View>
          {recipe.status === 'In Progress' && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>🍳 In Progress</Text>
            </View>
          )}
          <View style={styles.recipeMetaRow}>
            <Chip label={`${recipe.cookTime} mins`} />
            <Chip label={`${recipe.servings} servings`} />
            <Chip label={recipe.difficulty} />
            <Chip label={`${recipe.calories} cal`} />
          </View>
          <View style={styles.tagRow}>
            {recipe.tags.slice(0, 6).map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// Removed CommunityView - now using CommunityFeed component

interface AwardsViewProps {
  userXP: number;
  userLevel: string;
  rewardPoints: number;
  recipesCompleted: number;
}

function AwardsView({ userXP, userLevel, rewardPoints, recipesCompleted }: AwardsViewProps) {
  const router = useRouter();
  
  // Calculate next level threshold
  const levelThresholds = [
    { level: 'Beginner', minXP: 0 },
    { level: 'Novice Cook', minXP: 200 },
    { level: 'Home Chef', minXP: 500 },
    { level: 'Skilled Chef', minXP: 1000 },
    { level: 'Expert Chef', minXP: 2000 },
    { level: 'Master Chef', minXP: 5000 },
    { level: 'Culinary Legend', minXP: 10000 },
  ];
  
  const currentThresholdIndex = levelThresholds.findIndex(t => t.level === userLevel);
  const currentThreshold = levelThresholds[currentThresholdIndex] || levelThresholds[0];
  const nextThreshold = levelThresholds[currentThresholdIndex + 1] || levelThresholds[levelThresholds.length - 1];
  
  // Calculate progress percentage
  const xpInCurrentLevel = userXP - currentThreshold.minXP;
  const xpNeededForNext = nextThreshold.minXP - currentThreshold.minXP;
  const progressPercent = xpNeededForNext > 0 ? Math.min((xpInCurrentLevel / xpNeededForNext) * 100, 100) : 100;
  
  return (
    <View>
      {/* XP Progress Section */}
      <View style={styles.awardsHeader}>
        <Text style={styles.awardsTitle}>🏆 Your Progress</Text>
        
        {/* Experience Points Card */}
        <View style={styles.xpCard}>
          <View style={styles.xpCardHeader}>
            <Ionicons name="star" size={24} color="#f59e0b" />
            <Text style={styles.xpCardTitle}>Experience Points</Text>
          </View>

          {/* Current Level */}
          <View style={styles.levelRow}>
            <Text style={styles.levelTitle}>{userLevel}</Text>
            <Text style={styles.levelNext}>→ {nextThreshold.level}</Text>
          </View>
            
          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
            
          {/* XP Text */}
          <Text style={styles.progressLabel}>
            {userXP} / {nextThreshold.minXP} XP
          </Text>
        </View>

        {/* Reward Points Card */}
        <View style={styles.rewardPointsCard}>
          <View style={styles.xpCardHeader}>
            <Text style={{ fontSize: 20 }}>🎁</Text>
            <Text style={styles.rewardPointsCardTitle}>Reward Points</Text>
          </View>
          <Text style={styles.rewardPointsValue}>💰 {rewardPoints} points available</Text>
          <Text style={styles.rewardPointsHint}>Earn more through daily goals and achievements</Text>
          <TouchableOpacity 
            style={styles.viewRewardsBtn}
            onPress={() => router.push('/rewards')}
          >
            <Text style={styles.viewRewardsBtnText}>View Rewards Store</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsCards}>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{recipesCompleted}</Text>
          <Text style={styles.statCardLabel}>Recipes Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>0</Text>
          <Text style={styles.statCardLabel}>Posts Shared</Text>
        </View>
      </View>

      <Text style={styles.achievementsTitle}>Achievements</Text>
      <View style={styles.achievementGrid}>
        <MiniCard 
          title="Kitchen Novice" 
          subtitle="Complete 3 different recipes" 
          unlocked={recipesCompleted >= 3}
        />
        <MiniCard 
          title="Social Butterfly" 
          subtitle="Share 3 cooking creations"
          unlocked={false}
        />
        <MiniCard 
          title="Ingredient Master" 
          subtitle="Use 25 different ingredients"
          unlocked={false}
        />
        <MiniCard 
          title="Influenced Chef" 
          subtitle="Get 10 hearts on your post"
          unlocked={false}
        />
      </View>
    </View>
  );
}

/* --- Tiny components --- */

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// PostCard removed - now using CommunityFeed component

function MiniCard({ title, subtitle, unlocked = false }: { title: string; subtitle?: string; unlocked?: boolean }) {
  return (
    <View style={[styles.miniCard, unlocked && styles.miniCardUnlocked]}>
      <Text style={styles.miniIcon}>{unlocked ? '🏆' : '🔒'}</Text>
      <Text style={[styles.miniTitle, !unlocked && styles.miniTitleLocked]}>{title}</Text>
      <Text style={styles.miniSub}>{subtitle}</Text>
      {unlocked && <Text style={styles.miniUnlockedText}>Unlocked!</Text>}
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff7f0' },
  header: {
    height: 78,
    backgroundColor: '#18b66f',
    paddingHorizontal: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff' },
  hello: { color: '#fff', fontWeight: '700', fontSize: 16 },
  xpSmall: { color: '#e6ffe9', fontSize: 11, marginTop: 2 },
  // XP badge under name - clickable
  xpUnderName: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    gap: 4,
  },
  xpUnderNameText: {
    color: '#fef3c7',
    fontWeight: '700',
    fontSize: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  // Reward points badge in header right
  rewardPointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  rewardPointsEmoji: {
    fontSize: 14,
  },
  rewardPointsText: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 12,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  xpBadgeText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 14,
  },
  settings: {
    backgroundColor: '#ff9a5b',
    padding: 8,
    borderRadius: 8,
  },

  tabbar: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 6,
    justifyContent: 'space-between',
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  tabItemActive: { backgroundColor: '#ffb75c' },
  tabText: { color: '#444', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  badgeDot: {
    position: 'absolute',
    right: 12,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  /* Chat */
  chatBubbleFrom: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    elevation: 1,
  },
  chatBubbleFromGreen: {
    backgroundColor: '#e6fff0',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  chatBubbleTo: {
    backgroundColor: '#fff2ea',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  chatFromText: { color: '#0b2f1a' },
  chatToText: { color: '#6b2a00' },
  chatTime: { color: '#999', fontSize: 10, marginTop: 6 },

  /* Composer (fixed at bottom) */
  chatComposerContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    height: composerHeight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  plusBtn: { backgroundColor: '#2bb673', padding: 10, borderRadius: 10 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 46,
    borderColor: '#eee',
    borderWidth: 1,
  },
  sendBtn: { backgroundColor: '#2bb673', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },

  /* Recipe card */
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
  },
  recipeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recipeTitle: { fontWeight: '700', fontSize: 16, flex: 1, paddingRight: 8 },
  recipeRating: { color: '#f59e0b', fontWeight: '700' },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneIndicator: { marginLeft: 4 },
  progressBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  progressBadgeText: { fontSize: 12, color: '#92400e', fontWeight: '500' },
  recipeMetaRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  chip: {
    backgroundColor: '#fff3ec',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { color: '#7a4b2b', fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  tag: {
    backgroundColor: '#fff5f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: '#b45309', fontSize: 12 },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },

  /* Awards */
  awardsHeader: { backgroundColor: '#fff5e9', padding: 16, borderRadius: 12, elevation: 1 },
  awardsTitle: { fontWeight: '800', fontSize: 20, marginBottom: 16 },
  awardsXP: { marginTop: 4, color: '#b45309', fontSize: 14 },
  xpCard: {
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 16,
  },
  xpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  xpCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  levelNext: {
    fontSize: 12,
    color: '#b45309',
  },
  rewardPointsCard: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  rewardPointsCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
  },
  rewardPointsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
    marginTop: 4,
  },
  rewardPointsHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  viewRewardsBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  viewRewardsBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ffe4c9',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff8a3d',
    borderRadius: 4,
  },
  progressLabel: { fontSize: 12, color: '#92400e', marginTop: 6 },
  statsCards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
  },
  statCardValue: { fontSize: 28, fontWeight: '800', color: '#2bb673' },
  statCardLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  achievementsTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  miniCard: {
    width: (screenW - 56) / 2,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    alignItems: 'center',
  },
  miniCardUnlocked: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  miniIcon: { fontSize: 28, marginBottom: 8 },
  miniTitle: { fontWeight: '700', textAlign: 'center', fontSize: 14 },
  miniTitleLocked: { color: '#888' },
  miniSub: { marginTop: 6, color: '#666', fontSize: 12, textAlign: 'center' },
  miniUnlockedText: { marginTop: 8, color: '#22c55e', fontSize: 12, fontWeight: '600' },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 36,
    left: (screenW - 120) / 2,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2bb673',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
});