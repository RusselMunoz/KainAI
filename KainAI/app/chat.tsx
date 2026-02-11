
import React, { useState, useCallback, useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import axios from 'axios';

// Use local server proxy - Android emulator uses 10.0.2.2 to reach localhost
const API_BASE = Platform.select({
  android: 'http://10.0.2.2:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

interface ChatScreenProps {
  onRecipeGenerated?: (recipeId: string) => void;
}

export function ChatScreen({ onRecipeGenerated }: ChatScreenProps) {
  const [messages, setMessages] = useState<IMessage[]>([
    {
      _id: 'welcome',
      text: '🔄 Testing network with axios...',
      createdAt: new Date(),
      user: { _id: 2, name: 'Cheffy' },
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirmButtons, setShowConfirmButtons] = useState(false);
  const [pendingIngredientData, setPendingIngredientData] = useState<any>(null);

  // Test network on load using axios
  useEffect(() => {
    const testNetwork = async () => {
      try {
        console.log('🔍 Testing server connection...');
        const res = await axios.get(`${API_BASE}/api/chat`, { 
          timeout: 10000,
          validateStatus: () => true // Accept any status to test connectivity
        });
        console.log('✅ Server reachable:', res.status);
        
        setMessages([{
          _id: 'welcome',
          text: '✅ Connected! Hello, [User Name]! What ingredients are we working with today? Let\'s create something amazing together!',
          createdAt: new Date(),
          user: { _id: 2, name: 'Cheffy' },
        }]);
      } catch (e: any) {
        console.log('❌ Server connection failed:', e.message);
        setMessages([{
          _id: 'welcome',
          text: `❌ Cannot reach server: ${e.message}\n\nMake sure the server is running:\ncd server && node server.js`,
          createdAt: new Date(),
          user: { _id: 2, name: 'Cheffy' },
        }]);
      }
    };
    testNetwork();
  }, []);

  const getBotResponse = useCallback(async (userMessage: string, ingredientList?: string[], confirmed?: boolean) => {
    setIsTyping(true);
    setShowConfirmButtons(false);
    console.log('📤 Sending message to server proxy');
    try {
      // TODO: Replace with actual userId and ingredientList from your app state
      const userId = 'demo-user-id';
      const response = await axios.post(`${API_BASE}/api/chat`, {
        prompt: userMessage,
        userId,
        ingredientList,
        confirmed,
        temperature: 0.7,
        maxTokens: 512,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('📥 Response status:', response.status);
      const data = response.data;
      if (data.needsConfirmation) {
        // Show yes/no buttons for confirmation
        setShowConfirmButtons(true);
        setPendingIngredientData({
          prompt: userMessage,
          ingredientList,
        });
        setMessages((previousMessages: IMessage[]) =>
          GiftedChat.append(previousMessages, [{
            _id: Math.random().toString(36).substring(2),
            text: data.message,
            createdAt: new Date(),
            user: { _id: 2, name: 'Cheffy' },
          }]),
        );
        return;
      }
      let botText = '';
      if (data.ok && data.response) {
        botText = data.response;
        
        // If a recipe was generated and saved, notify parent to switch tabs
        if (data.recipeId && data.navigateTo === 'Recipes') {
          // Add a success message
          const successMessage: IMessage = {
            _id: Math.random().toString(36).substring(2),
            text: '✨ Recipe saved to your archive! Tap below to view it.',
            createdAt: new Date(),
            user: { _id: 2, name: 'Cheffy' },
          };
          setMessages((previousMessages: IMessage[]) =>
            GiftedChat.append(previousMessages, [successMessage]),
          );
          
          // Notify parent after a short delay
          setTimeout(() => {
            if (onRecipeGenerated) {
              onRecipeGenerated(data.recipeId);
            }
          }, 1500);
        }
      } else if (data.error) {
        botText = `Error: ${data.error}`;
      } else {
        botText = 'Sorry, I could not generate a response.';
      }
      const botMessage: IMessage = {
        _id: Math.random().toString(36).substring(2),
        text: botText,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((previousMessages: IMessage[]) =>
        GiftedChat.append(previousMessages, [botMessage]),
      );
    } catch (error: any) {
      console.error('❌ Axios error:', error.message);
      const errorMessage: IMessage = {
        _id: Math.random().toString(36).substring(2),
        text: `Error: ${error.message}`,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((previousMessages: IMessage[]) =>
        GiftedChat.append(previousMessages, [errorMessage]),
      );
    } finally {
      setIsTyping(false);
    }
  }, []);


  // Example: parse ingredient list from user message (replace with your own logic)
  function extractIngredients(text: string): string[] {
    // Simple comma split, improve as needed
    return text.split(',').map(s => s.trim()).filter(Boolean);
  }

  const onSend = useCallback((newMessages: IMessage[] = []) => {
    setMessages((previousMessages: IMessage[]) =>
      GiftedChat.append(previousMessages, newMessages),
    );
    const userMessage = newMessages[0]?.text ?? '';
    // Try to extract ingredients if message looks like a list
    const ingredientList = extractIngredients(userMessage);
    getBotResponse(userMessage, ingredientList);
  }, [getBotResponse]);

  // Handle Yes/No button press
  const handleConfirm = (allowExtra: boolean) => {
    setShowConfirmButtons(false);
    if (!pendingIngredientData) return;
    // If allowExtra is true, confirmed = false (let AI add more), else confirmed = true (use only provided)
    getBotResponse(
      pendingIngredientData.prompt,
      pendingIngredientData.ingredientList,
      allowExtra // confirmed
    );
    setPendingIngredientData(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <GiftedChat 
        messages={messages} 
        onSend={onSend} 
        user={{ _id: 1 }} 
        isTyping={isTyping}
      />
      {showConfirmButtons && (
        <View style={styles.confirmBar}>
          <Text style={styles.confirmText}>Allow Cheffy to add more ingredients?</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(true)}>
            <Text style={styles.confirmBtnText}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm(false)}>
            <Text style={styles.confirmBtnText}>No</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fffbe7',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  confirmText: {
    fontSize: 16,
    marginRight: 12,
    color: '#333',
  },
  confirmBtn: {
    backgroundColor: '#2bb673',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChatScreen;
