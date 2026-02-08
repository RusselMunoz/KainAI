import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function LicensesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Licenses / Acknowledgments</Text>
      <Text style={styles.text}>
        KainAI uses open-source software and resources. We gratefully acknowledge the following projects and contributors:
      </Text>
      <Text style={styles.subtitle}>Open Source Libraries</Text>
      <Text style={styles.text}>
        - React Native
        - Expo
        - Firebase
        - react-native-gifted-chat
        - @expo/vector-icons
        - And others
      </Text>
      <Text style={styles.subtitle}>Contributors</Text>
      <Text style={styles.text}>
        We thank all contributors and the open-source community for their support.
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
