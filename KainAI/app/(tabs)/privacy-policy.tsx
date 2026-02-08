import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.text}>
        We value your privacy. Your personal data, including dietary preferences and health information, is stored securely and never shared with third parties without your consent. We only use your data to improve your experience and provide personalized recipe recommendations. You can request deletion of your data at any time.
      </Text>
      <Text style={styles.subtitle}>Data Collection</Text>
      <Text style={styles.text}>
        We collect only the information you provide directly in the app, such as your profile, preferences, and feedback. No data is collected from external sources.
      </Text>
      <Text style={styles.subtitle}>Data Usage</Text>
      <Text style={styles.text}>
        Your data is used solely to personalize your experience and improve our services. We do not sell or share your data with advertisers or other companies.
      </Text>
      <Text style={styles.subtitle}>Contact</Text>
      <Text style={styles.text}>
        For questions or requests regarding your privacy, please contact us at support@kainai.app.
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
