import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign, Feather } from '@expo/vector-icons';
import { ChatScreen } from '../chat';

const TABS = ['Chat', 'Recipes', 'Community', 'Awards'];
const screenW = Dimensions.get('window').width;

// top inset so header won't overlap status HUD
const topInset = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 12 : 12;
const composerHeight = 66; // used for bottom padding so content isn't hidden
export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('Chat');

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.hello}>Hello, User!</Text>
            <Text style={styles.xpSmall}>Beginner • 150 XP</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Level</Text>
            <Text style={styles.levelValue}>Beginner</Text>
          </View>
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
            onPress={() => setTab(t)}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {t === 'Community' && <View style={styles.badgeDot} />}
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'Chat' && <ChatScreen />}
        {tab === 'Recipes' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: composerHeight + 120 }]}> 
            <RecipesView />
          </ScrollView>
        )}
        {tab === 'Community' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: composerHeight + 120 }]}>
            <CommunityView />
          </ScrollView>
        )}
        {tab === 'Awards' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: composerHeight + 120 }]}>
            <AwardsView />
          </ScrollView>
        )}
      </View>

      {/* FAB only for non-chat tabs */}
      {tab !== 'Chat' && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
          <Text style={styles.fabText}>Generate{'\n'}Recipe</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* --- Subviews --- */

function RecipesView() {
  return (
    <View>
      <View style={styles.recipeCard}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle}>One-Pot Chicken, Bell Peppers, Onion, and Rice with Potatoes</Text>
          <Text style={styles.recipeRating}>★ 4.8</Text>
        </View>
        <View style={styles.recipeMetaRow}>
          <Chip label="35 mins" />
          <Chip label="4 servings" />
          <Chip label="Easy" />
          <Chip label="485 cal" />
        </View>
        <View style={styles.tagRow}>
          {['One-Pot', 'Chicken', 'Rice', 'Vegetables', 'Easy', 'Family-Friendly'].map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CommunityView() {
  return (
    <View>
      <View style={styles.communityBanner}>
        <Text style={styles.bannerTitle}>Community Kitchen</Text>
        <Text style={styles.bannerSubtitle}>Share, learn, and cook together</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <PostCard
          author="Sarah Kitchen"
          title="Amazing Garlic Butter Shrimp"
          excerpt="Just made this incredible garlic butter shrimp recipe — quick and family loved it!"
        />
        <PostCard
          author="Mike Chef"
          title="Homemade Pizza Night Success!"
          excerpt="Finally nailed my pizza crust — cold fermentation 48 hours made the difference."
        />
      </View>
    </View>
  );
}

function AwardsView() {
  return (
    <View>
      <View style={styles.awardsHeader}>
        <Text style={styles.awardsTitle}>Your Cooking Journey</Text>
        <Text style={styles.awardsXP}>150 XP • Beginner</Text>
      </View>

      <View style={styles.achievementGrid}>
        <MiniCard title="Kitchen Novice" subtitle="Complete 3 different recipes" />
        <MiniCard title="Social Butterfly" subtitle="Share 3 cooking creations" />
        <MiniCard title="Ingredient Master" subtitle="Use 25 different ingredients" />
        <MiniCard title="Influenced Chef" subtitle="Get 10 hearts on your post" />
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

function PostCard({ author, title, excerpt }: { author: string; title: string; excerpt: string }) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.postAuthor}>{author}</Text>
          <Text style={styles.postTime}>2 hours ago • recipe</Text>
        </View>
        <Text style={styles.postRating}>4.8</Text>
      </View>
      <Text style={styles.postTitle}>{title}</Text>
      <Text style={styles.postExcerpt}>{excerpt}</Text>
      <View style={styles.postTags}>
        <View style={styles.tag}><Text style={styles.tagText}>#seafood</Text></View>
        <View style={styles.tag}><Text style={styles.tagText}>#quick</Text></View>
      </View>
    </View>
  );
}

function MiniCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniTitle}>{title}</Text>
      <Text style={styles.miniSub}>{subtitle}</Text>
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
  xpSmall: { color: '#e6ffe9', fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    backgroundColor: '#ff8a3d',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  levelText: { color: '#fff', fontSize: 10 },
  levelValue: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
  recipeHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  recipeTitle: { fontWeight: '700', fontSize: 16, flex: 1, paddingRight: 8 },
  recipeRating: { color: '#f59e0b', fontWeight: '700' },
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

  /* Post card */
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff' },
  postAuthor: { fontWeight: '700' },
  postTime: { color: '#888', fontSize: 12 },
  postRating: { fontWeight: '700' },
  postTitle: { marginTop: 8, fontWeight: '700' },
  postExcerpt: { marginTop: 6, color: '#555' },
  postTags: { flexDirection: 'row', marginTop: 10 },

  communityBanner: {
    backgroundColor: '#fff5f2',
    padding: 14,
    borderRadius: 12,
    elevation: 1,
  },
  bannerTitle: { fontWeight: '800', fontSize: 16 },
  bannerSubtitle: { marginTop: 6, color: '#666' },

  /* Awards */
  awardsHeader: { backgroundColor: '#fff5e9', padding: 14, borderRadius: 12, elevation: 1 },
  awardsTitle: { fontWeight: '800', fontSize: 16 },
  awardsXP: { marginTop: 6, color: '#b45309' },
  achievementGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  miniCard: {
    width: (screenW - 56) / 2,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 1,
  },
  miniTitle: { fontWeight: '700' },
  miniSub: { marginTop: 6, color: '#666' },

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