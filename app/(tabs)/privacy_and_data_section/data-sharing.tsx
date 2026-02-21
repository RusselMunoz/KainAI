import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function DataSharing() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Data Sharing & Community</Text>
      
      <Text style={styles.text}>
        At Cheffy, we believe cooking is better together. This section explains how your data is shared within our community and how we protect your private information.
      </Text>

      <Text style={styles.subtitle}>Public Community Sharing</Text>
      <Text style={styles.text}>
        When you choose to "Post to Community," certain data becomes visible to other users, including your <Text style={styles.boldText}>Username</Text>, <Text style={styles.boldText}>Chef Level</Text>, <Text style={styles.boldText}>Recipe Ratings</Text>, and any photos or comments you attach to your completed meals.
      </Text>

      <Text style={styles.subtitle}>Private Data Protection</Text>
      <Text style={styles.text}>
        Your personal email, precise location, and private recipe archive (items you have not posted) are <Text style={styles.boldText}>never</Text> shared with other users or third-party advertisers. Your "Not Done" list is for your eyes only.
      </Text>

      <Text style={styles.subtitle}>User Control</Text>
      <Text style={styles.text}>
        You have full control over your shared content. You can delete your community posts at any time, which will immediately remove them from the public feed.
      </Text>

      <Text style={styles.subtitle}>Third-Party Services</Text>
      <Text style={styles.text}>
        We use secure services like Firebase to host the community feed. We do not sell your cooking habits or ingredient data to external food corporations or data brokers.
      </Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Questions? Reach out to support@kainai.app</Text>
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
  boldText: {
    fontWeight: 'bold',
    color: '#18b66f'
  },
  subtitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    marginTop: 20, 
    marginBottom: 8, 
    color: '#e67e22' // Using your orange accent for subtitles to make them pop
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
