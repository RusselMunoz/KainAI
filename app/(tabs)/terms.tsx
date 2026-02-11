import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Terms & Conditions / Terms of Service</Text>
      <Text style={styles.text}>
        By using KainAI, you agree to use the app for personal, non-commercial purposes only. You are responsible for the accuracy of the information you provide. We are not liable for any adverse reactions to recipes or advice provided by the app. All content is for informational purposes and not a substitute for professional advice.
      </Text>
      <Text style={styles.subtitle}>User Responsibilities</Text>
      <Text style={styles.text}>
        You agree not to misuse the app, attempt to access data not intended for you, or use the app for unlawful purposes. You are responsible for your own health and dietary choices.
      </Text>
      <Text style={styles.subtitle}>Intellectual Property</Text>
      <Text style={styles.text}>
        All content, including recipes and images, is the property of KainAI or its licensors. You may not copy, distribute, or use content for commercial purposes without permission.
      </Text>
      <Text style={styles.subtitle}>Changes</Text>
      <Text style={styles.text}>
        We may update these terms at any time. Continued use of the app constitutes acceptance of the new terms.
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
