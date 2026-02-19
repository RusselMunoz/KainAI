// app/(tabs)/localization/language.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function LanguageSettings() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🌐</Text>
      </View>
      
      <Text style={styles.title}>Language Settings</Text>
      <Text style={styles.subtitle}>Coming Soon</Text>
      
      <Text style={styles.description}>
        Language localization is currently in development.{'\n'}
        English (US) is the default language.
      </Text>
      
      <View style={styles.languageList}>
        <Text style={styles.sectionTitle}>Available Languages</Text>
        
        <View style={styles.languageItem}>
          <Text style={styles.languageText}>English (US)</Text>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        
        <View style={[styles.languageItem, styles.comingSoon]}>
          <Text style={[styles.languageText, styles.comingSoonText]}>Filipino (Tagalog)</Text>
          <Text style={styles.badge}>Coming Soon</Text>
        </View>
        
        <View style={[styles.languageItem, styles.comingSoon]}>
          <Text style={[styles.languageText, styles.comingSoonText]}>Spanish</Text>
          <Text style={styles.badge}>Coming Soon</Text>
        </View>
        
        <View style={[styles.languageItem, styles.comingSoon]}>
          <Text style={[styles.languageText, styles.comingSoonText]}>Chinese (Simplified)</Text>
          <Text style={styles.badge}>Coming Soon</Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Want to help translate KainAI?{'\n'}
          Contact us at translate@kainai.app
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff7f0' 
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: '#18b66f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 16,
  },
  description: { 
    fontSize: 15, 
    lineHeight: 22, 
    color: '#666', 
    textAlign: 'center',
    marginBottom: 32,
  },
  languageList: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18b66f',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e7e0',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  checkmark: {
    fontSize: 18,
    color: '#18b66f',
    fontWeight: '700',
  },
  comingSoon: {
    opacity: 0.7,
  },
  comingSoonText: {
    color: '#888',
  },
  badge: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    backgroundColor: '#fff8e7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    width: '100%',
  },
  footerText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
