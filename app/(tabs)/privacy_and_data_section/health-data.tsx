import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function HealthData() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Health & Nutrition Data</Text>
      
      <Text style={styles.text}>
        Cheffy provides nutritional insights to help you cook smarter. Here is how we handle your dietary and health-related information.
      </Text>

      <Text style={styles.subtitle}>Nutritional Accuracy</Text>
      <Text style={styles.text}>
        Calculations for calories and macronutrients (Protein, Carbs, Fats) are AI-generated estimates based on standard ingredient data. These should be used as a general guide and not as medical advice.
      </Text>

      <Text style={styles.subtitle}>Dietary Preferences</Text>
      <Text style={styles.text}>
        Any dietary restrictions or allergies you share with the Cheffy AI are used strictly to filter recipe results. This data is stored locally to ensure your generated recipes remain safe and relevant to your needs.
      </Text>

      <Text style={styles.subtitle}>Personal Health Privacy</Text>
      <Text style={styles.text}>
        While you may share your cooked meals with the community, your specific nutritional goals, weight-management progress, or allergy profiles are **never** made public. Only the recipe itself and your rating are shared.
      </Text>

      <Text style={styles.subtitle}>Medical Disclaimer</Text>
      <Text style={styles.text}>
        Cheffy is a cooking assistant, not a certified nutritionist. If you have severe allergies or specific medical dietary requirements, please consult a healthcare professional.
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Stay healthy with Cheffy! support@kainai.app</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff7f0' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800', 
    marginBottom: 16, 
    color: '#18b66f',
    letterSpacing: 0.5 
  },
  subtitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    marginTop: 20, 
    marginBottom: 8, 
    color: '#e67e22' 
  },
  text: { 
    fontSize: 15, 
    lineHeight: 22, 
    color: '#444', 
    marginBottom: 10 
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  footerText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic'
  }
});