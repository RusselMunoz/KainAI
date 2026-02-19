import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Data class representing a single leaderboard entry.
class LeaderboardEntry {
  final String uid;
  final String displayName;
  final String? photoURL;
  final int xp;
  final String level;
  final int recipesCompleted;

  const LeaderboardEntry({
    required this.uid,
    required this.displayName,
    this.photoURL,
    required this.xp,
    required this.level,
    required this.recipesCompleted,
  });

  factory LeaderboardEntry.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return LeaderboardEntry(
      uid: doc.id,
      displayName: (data['displayName'] as String?) ?? 'Anonymous',
      photoURL: data['photoURL'] as String?,
      xp: (data['xp'] as num?)?.toInt() ?? 0,
      level: (data['level'] as String?) ?? 'Beginner',
      recipesCompleted: (data['recipesCompleted'] as num?)?.toInt() ?? 0,
    );
  }
}

/// XP thresholds aligned with the project's level system.
const Map<String, int> _levelThresholds = {
  'Beginner': 0,
  'Intermediate': 200,
  'Advanced': 500,
  'Expert': 1000,
  'Master Chef': 2000,
};

Color _levelColor(String level) {
  switch (level) {
    case 'Master Chef':
      return const Color(0xFFFFD700);
    case 'Expert':
      return const Color(0xFFE040FB);
    case 'Advanced':
      return const Color(0xFF2979FF);
    case 'Intermediate':
      return const Color(0xFF2AA96A);
    default:
      return const Color(0xFF78909C);
  }
}

IconData _rankIcon(int rank) {
  switch (rank) {
    case 1:
      return Icons.emoji_events;
    case 2:
      return Icons.workspace_premium;
    case 3:
      return Icons.military_tech;
    default:
      return Icons.person;
  }
}

Color _rankColor(int rank) {
  switch (rank) {
    case 1:
      return const Color(0xFFFFD700); // gold
    case 2:
      return const Color(0xFFC0C0C0); // silver
    case 3:
      return const Color(0xFFCD7F32); // bronze
    default:
      return const Color(0xFF78909C);
  }
}

// ---------------------------------------------------------------------------
// LeaderboardScreen — StatefulWidget
// ---------------------------------------------------------------------------

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  bool _isLoading = true;
  String? _error;
  List<LeaderboardEntry> _entries = [];
  int? _currentUserRank;
  String? _currentUserId;

  // -----------------------------------------------------------------------
  // Lifecycle — all Firestore work starts here, never at the top level.
  // -----------------------------------------------------------------------

  @override
  void initState() {
    super.initState();

    // Schedule the fetch for after the first frame so the widget is fully
    // mounted before any async work begins (keeps heavy logic lazy).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchLeaderboard();
    });
  }

  // -----------------------------------------------------------------------
  // Data fetching — called exclusively from initState's post-frame callback.
  // -----------------------------------------------------------------------

  Future<void> _fetchLeaderboard() async {
    try {
      _currentUserId = FirebaseAuth.instance.currentUser?.uid;

      // Query the users collection ordered by XP descending, top 50.
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .where('is_active', isEqualTo: true)
          .orderBy('xp', descending: true)
          .limit(50)
          .get();

      final entries =
          snapshot.docs.map((doc) => LeaderboardEntry.fromFirestore(doc)).toList();

      // Determine the current user's rank (1-indexed).
      int? userRank;
      if (_currentUserId != null) {
        final idx = entries.indexWhere((e) => e.uid == _currentUserId);
        if (idx != -1) {
          userRank = idx + 1;
        }
      }

      if (!mounted) return;

      setState(() {
        _entries = entries;
        _currentUserRank = userRank;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  // -----------------------------------------------------------------------
  // Pull-to-refresh handler.
  // -----------------------------------------------------------------------

  Future<void> _onRefresh() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    await _fetchLeaderboard();
  }

  // -----------------------------------------------------------------------
  // Build — pure UI, no Firestore calls or StreamBuilders here.
  // -----------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFF7F0),
      appBar: AppBar(
        title: const Text('Leaderboard'),
        backgroundColor: const Color(0xFF18B66F),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          color: Color(0xFF18B66F),
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
              const SizedBox(height: 12),
              Text(
                'Failed to load leaderboard',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black54, fontSize: 13),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _onRefresh,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF18B66F),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_entries.isEmpty) {
      return const Center(
        child: Text(
          'No leaderboard data yet.\nStart cooking to earn XP!',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 16, color: Colors.black54),
        ),
      );
    }

    return Column(
      children: [
        // Current user rank banner
        if (_currentUserRank != null) _buildCurrentUserBanner(),

        // Leaderboard list
        Expanded(
          child: RefreshIndicator(
            color: const Color(0xFF18B66F),
            onRefresh: _onRefresh,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: _entries.length,
              itemBuilder: (context, index) {
                return _buildLeaderboardTile(index + 1, _entries[index]);
              },
            ),
          ),
        ),
      ],
    );
  }

  // -----------------------------------------------------------------------
  // Sub-widgets
  // -----------------------------------------------------------------------

  Widget _buildCurrentUserBanner() {
    final rank = _currentUserRank!;
    final entry = _entries[rank - 1];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF18B66F), Color(0xFF2AA96A)],
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF18B66F).withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: Colors.white24,
            backgroundImage:
                entry.photoURL != null ? NetworkImage(entry.photoURL!) : null,
            child: entry.photoURL == null
                ? const Icon(Icons.person, color: Colors.white)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your Rank',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '#$rank — ${entry.displayName}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entry.xp} XP',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                entry.level,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLeaderboardTile(int rank, LeaderboardEntry entry) {
    final isCurrentUser = entry.uid == _currentUserId;
    final isTopThree = rank <= 3;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: isCurrentUser ? const Color(0xFFE8F5E9) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: isCurrentUser
            ? Border.all(color: const Color(0xFF18B66F), width: 1.5)
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        leading: _buildRankBadge(rank),
        title: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFFE0E0E0),
              backgroundImage:
                  entry.photoURL != null ? NetworkImage(entry.photoURL!) : null,
              child: entry.photoURL == null
                  ? Text(
                      entry.displayName.isNotEmpty
                          ? entry.displayName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            // Name + level
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight:
                          isTopThree ? FontWeight.bold : FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _levelColor(entry.level).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          entry.level,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _levelColor(entry.level),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${entry.recipesCompleted} recipes',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        trailing: Text(
          '${entry.xp} XP',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
            color: isTopThree ? _rankColor(rank) : const Color(0xFF18B66F),
          ),
        ),
      ),
    );
  }

  Widget _buildRankBadge(int rank) {
    if (rank <= 3) {
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _rankColor(rank).withOpacity(0.15),
        ),
        child: Icon(
          _rankIcon(rank),
          color: _rankColor(rank),
          size: 22,
        ),
      );
    }

    return SizedBox(
      width: 36,
      height: 36,
      child: Center(
        child: Text(
          '#$rank',
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: Colors.black54,
          ),
        ),
      ),
    );
  }
}
