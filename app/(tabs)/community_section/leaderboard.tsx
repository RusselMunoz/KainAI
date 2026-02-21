import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function LeaderboardScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
			<Text style={styles.title}>Leaderboard</Text>

			<Text style={styles.subtitle}>How It Works</Text>
			<Text style={styles.text}>
				Users earn XP by completing recipes and uploading photo proof. The more
				complex the recipe, the more XP you earn.
			</Text>

			<Text style={styles.subtitle}>Rankings</Text>
			<Text style={styles.text}>
				All KainAI users are ranked globally based on their total XP accumulated
				from completed recipes.
			</Text>

			<Text style={styles.subtitle}>Your Rank</Text>
			<Text style={styles.text}>
				Complete recipes and submit photo proof to earn XP and climb the
				leaderboard. Your rank updates automatically after every verified
				completion.
			</Text>

			<Text style={styles.subtitle}>Rank Tiers</Text>
			<Text style={styles.text}>
				Beginner, Home Cook, Sous Chef, Head Chef, Master Chef. Each tier
				requires more XP to reach.
			</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff7f0' },
	title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#18b66f' },
	subtitle: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 6, color: '#2aa96a' },
	text: { fontSize: 15, color: '#222', marginBottom: 8 },
});
