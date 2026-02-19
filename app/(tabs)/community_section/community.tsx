import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

export default function CommunityScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<Text style={styles.subtitle}>What is the Community?</Text>
			<Text style={styles.text}>
				The KainAI community is where you can browse and share completed
				recipes with other home cooks, get inspiration, and celebrate your
				cooking progress together.
			</Text>

			<Text style={styles.subtitle}>How to Share</Text>
			<Text style={styles.text}>
				After you complete a recipe, upload a photo proof of your creation
				and add a short caption. Your post will appear in the community feed
				so other KainAI users can see, react, and learn from your dishes.
			</Text>

			<Text style={styles.subtitle}>Community Guidelines</Text>
			<Text style={styles.text}>
				Please be respectful and kind when sharing and commenting. Only post
				food-related content that you have the rights to share, and keep all
				photos and captions appropriate for all ages.
			</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff7f0' },
	content: { padding: 20 },
	title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#18b66f' },
	subtitle: {
		fontSize: 16,
		fontWeight: '700',
		marginTop: 18,
		marginBottom: 6,
		color: '#2aa96a',
	},
	text: { fontSize: 15, color: '#222', marginBottom: 8 },
});
