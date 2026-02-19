import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RewardsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoSection}>
        <Text style={styles.infoHeading}>How Rewards Work</Text>
        <Text style={styles.infoText}>
          XP earned from completing recipes in KainAI can be redeemed for
          grocery discounts and digital vouchers with selected partners.
        </Text>

        <Text style={styles.infoHeading}>Eligible Partners</Text>
        <Text style={styles.infoText}>
          Placeholder partner grocery stores will appear here, such as
          FreshMart, GreenGrocer, and other participating supermarkets in
          your area.
        </Text>

        <Text style={styles.infoHeading}>How to Redeem</Text>
        <Text style={styles.infoText}>
          When rewards are available, open the Rewards section in the app,
          choose an offer you like, and follow the on-screen steps to claim
          your discount or voucher code.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7f0',
  },
  content: {
    padding: 16,
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  infoHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
});