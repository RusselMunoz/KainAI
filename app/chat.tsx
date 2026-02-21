
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Keyboard, ActivityIndicator, Dimensions } from 'react-native';
import { GiftedChat, IMessage, Bubble } from 'react-native-gifted-chat';
import axios from 'axios';
import { validateIngredient } from '../services/profanity-filter.service';
import recipeService from '../services/recipe.service';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import type { Recipe } from '../types';

// Get screen width for button sizing - match chat bubble width
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHAT_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75; // GiftedChat default bubble width is ~75%

// Time formatting helper - converts to Philippine Time (PHT/GMT+8)
const formatToPHT = (date: Date): string => {
  try {
    // Format in Philippine timezone
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date) + ' PHT';
  } catch (e) {
    // Fallback if timezone not supported
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
};

// DEBUG MODE - set to true for extra logging and test controls
const DEBUG_MODE = true;
const SHOW_DEBUG = false;

// Special message types
const MESSAGE_TYPE_CONFIRMATION = 'confirmation';
const MESSAGE_TYPE_THINKING = 'thinking';
const MESSAGE_TYPE_ADD_MORE = 'add_more';
const MESSAGE_TYPE_DIETARY_ALTERNATIVE = 'dietary_alternative';

// Use local server proxy - Android emulator uses 10.0.2.2 to reach localhost
const API_BASE = Platform.select({
  android: 'http://localhost:5173',
  ios: 'http://localhost:5173',
  default: 'http://localhost:5173',
});

interface ChatScreenProps {
  onRecipeGenerated?: (recipeId: string) => void;
}

// Extended message interface to support custom message types
interface ExtendedMessage extends IMessage {
  messageType?: string;
  confirmationData?: {
    prompt: string;
    ingredientList: string[];
  };
}

export function ChatScreen({ onRecipeGenerated }: ChatScreenProps) {
  // Get user from auth context for personalized greetings (matches header greeting)
  const { user } = useAuth();
  const { profile } = useUser();
  const resolvedDisplayName = profile.displayName?.trim() || user?.displayName || '';
  const userName = resolvedDisplayName
    ? resolvedDisplayName.split(' ')[0]
    : 'Chef';
  const activeUserId = user?.uid ?? null;

  const [messages, setMessages] = useState<ExtendedMessage[]>([
    {
      _id: 'welcome',
      text: '🔄 Testing network with axios...',
      createdAt: new Date(),
      user: { _id: 2, name: 'Cheffy' },
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState(''); // Track input text for manual send
  const [pendingAddIngredients, setPendingAddIngredients] = useState<string[] | null>(null); // Track ingredients when adding more
  const lastSavedRecipeRef = useRef<string | null>(null);

  const persistGeneratedRecipe = useCallback(
    async (recipeId?: string | null, recipePayload?: Recipe | null) => {
      if (!activeUserId) {
        return;
      }

      try {
        const syncedRecipe = await recipeService.syncGeneratedRecipe(
          activeUserId,
          recipePayload ?? null,
          recipeId ?? null,
        );

        if (!syncedRecipe) {
          return;
        }

        if (lastSavedRecipeRef.current === syncedRecipe.id) {
          return;
        }
        lastSavedRecipeRef.current = syncedRecipe.id;
      } catch (error) {
        console.error('❌ Failed to persist generated recipe:', error);
      }
    },
    [activeUserId]
  );
  
  // Check if there's an active confirmation message requiring button interaction
  const hasActiveConfirmation = messages.some(
    m =>
      m.messageType === MESSAGE_TYPE_CONFIRMATION ||
      m.messageType === MESSAGE_TYPE_ADD_MORE ||
      m.messageType === MESSAGE_TYPE_DIETARY_ALTERNATIVE
  );
  
  // Debug: Log when component mounts
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log('🎬 ChatScreen mounted');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔗 API_BASE:', API_BASE);
    }
  }, []);

  // Test network on load using axios - depends on userName from profile
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
          text: `Hello, ${userName}! What ingredients are we working with today? Let's create something amazing together!`,
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
  }, [userName]); // Re-run when username changes

  // Remove thinking message from chat
  const removeThinkingMessage = useCallback(() => {
    setMessages((prev) => prev.filter(m => m.messageType !== MESSAGE_TYPE_THINKING));
  }, []);

  // Add thinking message to chat
  const addThinkingMessage = useCallback(() => {
    const thinkingMsg: ExtendedMessage = {
      _id: 'thinking-' + Date.now(),
      text: '🤔 Cheffy is thinking...',
      createdAt: new Date(),
      user: { _id: 2, name: 'Cheffy' },
      messageType: MESSAGE_TYPE_THINKING,
    };
    setMessages((prev) => GiftedChat.append(prev, [thinkingMsg]));
  }, []);

  const getBotResponse = useCallback(async (userMessage: string, ingredientList?: string[], confirmed?: boolean, allowAlternative?: boolean) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔵 getBotResponse CALLED');
    console.log('   userMessage:', userMessage);
    console.log('   ingredientList:', ingredientList);
    console.log('   confirmed:', confirmed);
    console.log('   allowAlternative:', allowAlternative);
    
    setIsTyping(true);
    
    // Add thinking message with animation for confirmed requests (recipe generation)
    if (confirmed) {
      addThinkingMessage();
    }
    
    // Use actual Firebase UID from auth, fallback to demo mode if not authenticated
    const requestUserId = activeUserId || 'demo-user-id';
    const requestBody = {
      prompt: userMessage,
      userId: requestUserId,
      ingredientList,
      confirmed,
      allowAlternative,
      temperature: 0.7,
      maxTokens: 512,
    };
    
    console.log('📤 POST request to:', `${API_BASE}/api/chat`);
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
      const response = await axios.post(`${API_BASE}/api/chat`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
      console.log('✅ Response received:', response.status);
      const {data} = response;
      console.log('📥 Response data:', JSON.stringify(data, null, 2).slice(0, 500));
      if (data.needsConfirmation) {
        // Create confirmation message with Yes/No buttons embedded inside
        const confirmationMsg: ExtendedMessage = {
          _id: Math.random().toString(36).substring(2),
          text: data.message,
          createdAt: new Date(),
          user: { _id: 2, name: 'Cheffy' },
          messageType: MESSAGE_TYPE_CONFIRMATION,
          confirmationData: {
            prompt: userMessage,
            ingredientList: ingredientList || [],
          },
        };
        setMessages((previousMessages) =>
          GiftedChat.append(previousMessages, [confirmationMsg]),
        );
        return;
      }
      if (data.dietaryViolation && data.offerAlternative) {
        removeThinkingMessage();
        const alternativeMsg: ExtendedMessage = {
          _id: Math.random().toString(36).substring(2),
          text: data.response,
          createdAt: new Date(),
          user: { _id: 2, name: 'Cheffy' },
          messageType: MESSAGE_TYPE_DIETARY_ALTERNATIVE,
          confirmationData: {
            prompt: userMessage,
            ingredientList: ingredientList || [],
          },
        };
        setMessages((previousMessages) =>
          GiftedChat.append(previousMessages, [alternativeMsg]),
        );
        return;
      }
      let botText = '';
      if (data.ok && data.response) {
        botText = data.response;
        
        // Remove thinking message before adding response
        removeThinkingMessage();

        if (data.recipeId || data.recipe) {
          await persistGeneratedRecipe(data.recipeId ?? null, (data.recipe as Recipe) ?? null);
        }
        
        // If a recipe was generated and saved, notify parent to switch tabs
        if (data.recipeId && data.navigateTo === 'Recipes') {
          // Add a success message
          const successMessage: ExtendedMessage = {
            _id: Math.random().toString(36).substring(2),
            text: '✨ Recipe generated and saved! Switching to Recipes tab...',
            createdAt: new Date(),
            user: { _id: 2, name: 'Cheffy' },
          };
          setMessages((previousMessages) =>
            GiftedChat.append(previousMessages, [successMessage]),
          );
          
          // Notify parent after a short delay to switch tabs
          setTimeout(() => {
            if (onRecipeGenerated) {
              onRecipeGenerated(data.recipeId);
            }
          }, 1500);
        }
      } else if (data.ok === false && data.conflict === true && data.message) {
        removeThinkingMessage();
        const alternativeMsg: ExtendedMessage = {
          _id: Math.random().toString(36).substring(2),
          text: data.message,
          createdAt: new Date(),
          user: { _id: 2, name: 'Cheffy' },
          messageType: MESSAGE_TYPE_DIETARY_ALTERNATIVE,
          confirmationData: {
            prompt: userMessage,
            ingredientList: ingredientList || [],
          },
        };
        setMessages((previousMessages) =>
          GiftedChat.append(previousMessages, [alternativeMsg]),
        );
        return;
      } else if (data.error) {
        botText = `Error: ${data.error}`;
      } else {
        botText = 'Sorry, I could not generate a response.';
      }
      const botMessage: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: botText,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, [botMessage]),
      );
    } catch (error: any) {
      console.error('❌ Axios error:', error.message);
      console.error('❌ Error details:', error.code, error.config?.url);
      if (error.response) {
        console.error('❌ Response error:', error.response.status, error.response.data);
      }
      removeThinkingMessage();
      const errorMessage: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: `Error: ${error.message}`,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, [errorMessage]),
      );
    } finally {
      setIsTyping(false);
      removeThinkingMessage();
    }
  }, [addThinkingMessage, removeThinkingMessage, onRecipeGenerated, activeUserId, persistGeneratedRecipe]);


  // Example: parse ingredient list from user message (replace with your own logic)
  function extractIngredients(text: string): string[] {
    // Split by comma and filter out empty/invalid entries
    const ingredients = text.split(',').map(s => s.trim()).filter(Boolean);
    
    // Validate each ingredient (includes profanity filter)
    const validIngredients: string[] = [];
    const invalidIngredients: string[] = [];
    
    for (const ingredient of ingredients) {
      const validation = validateIngredient(ingredient);
      if (validation.isValid) {
        validIngredients.push(ingredient);
      } else {
        invalidIngredients.push(ingredient);
        console.log(`⚠️ Invalid ingredient rejected: "${ingredient}" - ${validation.error}`);
      }
    }
    
    // Alert user if any ingredients were rejected
    if (invalidIngredients.length > 0) {
      Alert.alert(
        'Invalid Ingredients',
        `Some ingredients were not accepted. Please enter valid food items.`,
        [{ text: 'OK' }]
      );
    }
    
    return validIngredients;
  }

  const onSend = useCallback((newMessages: ExtendedMessage[] = []) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 onSend TRIGGERED!');
    console.log('📨 Messages received:', newMessages?.length || 0);
    console.log('📝 Message content:', JSON.stringify(newMessages, null, 2));
    
    if (!newMessages || newMessages.length === 0) {
      console.log('⚠️ No messages to send - ABORTING');
      return;
    }
    
    // Clear input text after sending
    setInputText('');
    
    const userMessage = newMessages[0]?.text ?? '';
    console.log('💬 User said:', userMessage);
    
    // Add user message to chat
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, newMessages),
    );
    
    // Extract ingredients if message looks like a list
    const newIngredients = extractIngredients(userMessage);
    
    // Check if we're in "add more" mode - merge with existing ingredients
    let ingredientList = newIngredients;
    if (pendingAddIngredients && pendingAddIngredients.length > 0) {
      // Merge new ingredients with existing ones (remove duplicates)
      ingredientList = [...new Set([...pendingAddIngredients, ...newIngredients])];
      console.log('🔀 Merged ingredients (existing + new):', ingredientList);
      setPendingAddIngredients(null); // Clear pending state
    }
    
    console.log('🥕 Final ingredients:', ingredientList);
    console.log('📤 Calling getBotResponse...');
    getBotResponse(userMessage, ingredientList);
  }, [getBotResponse, pendingAddIngredients]);

  // Manual send function for debugging - bypasses GiftedChat
  const manualSend = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 MANUAL SEND triggered');
    console.log('📝 Input text:', inputText);
    
    if (!inputText.trim()) {
      console.log('⚠️ Empty input - nothing to send');
      Alert.alert('Empty input', 'Please type something first');
      return;
    }
    
    const message: ExtendedMessage = {
      _id: Math.random().toString(36).substring(2),
      text: inputText.trim(),
      createdAt: new Date(),
      user: { _id: 1, name: 'User' },
    };
    
    onSend([message]);
    setInputText(''); // Clear after sending
  }, [inputText, onSend]);

  // Quick test function with predefined ingredients
  const quickTest = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 QUICK TEST triggered');
    
    const testMessage: ExtendedMessage = {
      _id: Math.random().toString(36).substring(2),
      text: 'chicken, garlic, rice, soy sauce',
      createdAt: new Date(),
      user: { _id: 1, name: 'User' },
    };
    
    onSend([testMessage]);
  }, [onSend]);

  // Handle Yes/No button press from confirmation bubble
  const handleConfirm = useCallback((messageId: string, confirmationData: { prompt: string; ingredientList: string[] }, choice: 'yes' | 'no' | 'recommend') => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CONFIRM button pressed');
    console.log('   choice:', choice);
    console.log('   confirmationData:', confirmationData);
    
    // Remove the confirmation message (replace with user's choice)
    setMessages((prev) => prev.filter(m => m._id !== messageId));
    
    if (choice === 'yes') {
      // Add user's response message
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: '✅ Yes, these ingredients are final!',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));
      
      // User confirmed - proceed with recipe generation
      getBotResponse(
        confirmationData.prompt,
        confirmationData.ingredientList,
        true // confirmed = true means "proceed with generation"
      );
    } else if (choice === 'recommend') {
      // User wants AI recommendations
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: '🤖 Recommend additional ingredients',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));
      
      // Ask AI for complementary ingredient suggestions
      const thinkingMsg: ExtendedMessage = {
        _id: 'thinking-' + Date.now(),
        text: '🤔 Thinking of ingredients that would complement yours...',
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
        messageType: MESSAGE_TYPE_THINKING,
      };
      setMessages((prev) => GiftedChat.append(prev, [thinkingMsg]));
      
      // Call server with special recommend mode
      getBotResponse(
        `Based on these ingredients: ${confirmationData.ingredientList.join(', ')}. What 3-5 additional ingredients would complement them well for a delicious recipe? List each suggestion on a new line.`,
        confirmationData.ingredientList,
        false // Not confirmed yet - will get recommendations
      );
    } else {
      // User said no - offer to add more ingredients or start fresh (better UX)
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: '❌ No, let me modify.',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));
      
      const addMoreMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: `Your current ingredients: ${confirmationData.ingredientList.join(', ')}\n\nWould you like to add more ingredients to this list, or start fresh with different ones?`,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
        messageType: MESSAGE_TYPE_ADD_MORE,
        confirmationData: confirmationData, // Pass along the original data
      };
      setMessages((prev) => GiftedChat.append(prev, [addMoreMsg]));
    }
  }, [getBotResponse]);

  // Handle Add More / Start Fresh buttons
  const handleAddMoreChoice = useCallback((messageId: string, confirmationData: { prompt: string; ingredientList: string[] }, addMore: boolean) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ ADD MORE CHOICE pressed');
    console.log('   addMore:', addMore);
    
    // Remove the add more message
    setMessages((prev) => prev.filter(m => m._id !== messageId));
    
    if (addMore) {
      // User wants to add more - keep existing ingredients and prompt for additions
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: '➕ Add more ingredients',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));
      
      const promptMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: `Great! Current ingredients: ${confirmationData.ingredientList.join(', ')}\n\nType any additional ingredients to add (comma-separated):`,
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((prev) => GiftedChat.append(prev, [promptMsg]));
      
      // Store the pending data so we can merge new ingredients
      setPendingAddIngredients(confirmationData.ingredientList);
    } else {
      // User wants to start fresh
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: '🔄 Start fresh',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));
      
      const promptMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: "No problem! Tell me what ingredients you'd like to use for your new recipe:",
        createdAt: new Date(),
        user: { _id: 2, name: 'Cheffy' },
      };
      setMessages((prev) => GiftedChat.append(prev, [promptMsg]));
      
      // Clear any pending add ingredients
      setPendingAddIngredients(null);
    }
  }, []);

  const handleDietaryAlternativeChoice = useCallback((messageId: string, confirmationData: { prompt: string; ingredientList: string[] }, choice: 'yes' | 'no') => {
    setMessages((prev) => prev.filter(m => m._id !== messageId));

    if (choice === 'yes') {
      const userResponseMsg: ExtendedMessage = {
        _id: Math.random().toString(36).substring(2),
        text: 'Allow Alternatives',
        createdAt: new Date(),
        user: { _id: 1, name: 'User' },
      };
      setMessages((prev) => GiftedChat.append(prev, [userResponseMsg]));

      getBotResponse(
        confirmationData.prompt,
        confirmationData.ingredientList,
        true,
        true
      );
      return;
    }

    const userResponseMsg: ExtendedMessage = {
      _id: Math.random().toString(36).substring(2),
      text: "No, I'll change ingredients",
      createdAt: new Date(),
      user: { _id: 1, name: 'User' },
    };
    const promptMsg: ExtendedMessage = {
      _id: Math.random().toString(36).substring(2),
      text: 'Okay. Update your ingredient list and I will generate a compliant recipe.',
      createdAt: new Date(),
      user: { _id: 2, name: 'Cheffy' },
    };
    setMessages((prev) => GiftedChat.append(prev, [userResponseMsg, promptMsg]));
  }, [getBotResponse]);

  // Custom bubble renderer to show Yes/No buttons inside confirmation messages
  const renderBubble = useCallback((props: any) => {
    const { currentMessage } = props;
    
    // Check if this is a confirmation message with 3 options
    if (currentMessage?.messageType === MESSAGE_TYPE_CONFIRMATION && currentMessage?.confirmationData) {
      return (
        <View style={styles.confirmationBubble}>
          <Bubble
            {...props}
            wrapperStyle={{
              left: styles.botBubbleWrapper,
            }}
            textStyle={{
              left: styles.botBubbleText,
            }}
          />
          <View style={styles.confirmButtonsColumn}>
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.yesBtn]}
              onPress={() => handleConfirm(currentMessage._id, currentMessage.confirmationData, 'yes')}
            >
              <Text style={styles.fullWidthBtnText}>✅ Yes, finalize ingredients</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.addMoreBtn]}
              onPress={() => handleConfirm(currentMessage._id, currentMessage.confirmationData, 'no')}
            >
              <Text style={styles.fullWidthBtnText}>➕ Add more ingredients</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.recommendBtn]}
              onPress={() => handleConfirm(currentMessage._id, currentMessage.confirmationData, 'recommend')}
            >
              <Text style={styles.fullWidthBtnText}>🤖 Suggest complementary ingredients</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Check if this is an "add more" message (after user clicks No)
    if (currentMessage?.messageType === MESSAGE_TYPE_ADD_MORE && currentMessage?.confirmationData) {
      return (
        <View style={styles.confirmationBubble}>
          <Bubble
            {...props}
            wrapperStyle={{
              left: styles.botBubbleWrapper,
            }}
            textStyle={{
              left: styles.botBubbleText,
            }}
          />
          <View style={styles.confirmButtonsInBubble}>
            <TouchableOpacity
              style={[styles.inBubbleBtn, styles.addMoreBtn]}
              onPress={() => handleAddMoreChoice(currentMessage._id, currentMessage.confirmationData, true)}
            >
              <Text style={styles.inBubbleBtnText}>➕ Add More</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inBubbleBtn, styles.startFreshBtn]}
              onPress={() => handleAddMoreChoice(currentMessage._id, currentMessage.confirmationData, false)}
            >
              <Text style={styles.inBubbleBtnText}>🔄 Start Fresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (currentMessage?.messageType === MESSAGE_TYPE_DIETARY_ALTERNATIVE && currentMessage?.confirmationData) {
      return (
        <View style={styles.confirmationBubble}>
          <Bubble
            {...props}
            wrapperStyle={{
              left: styles.botBubbleWrapper,
            }}
            textStyle={{
              left: styles.botBubbleText,
            }}
          />
          <View style={styles.confirmButtonsColumn}>
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.yesBtn]}
              onPress={() => handleDietaryAlternativeChoice(currentMessage._id, currentMessage.confirmationData, 'yes')}
            >
              <Text style={styles.fullWidthBtnText}>Allow Alternatives</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fullWidthBtn, styles.noBtn]}
              onPress={() => handleDietaryAlternativeChoice(currentMessage._id, currentMessage.confirmationData, 'no')}
            >
              <Text style={styles.fullWidthBtnText}>No, I'll change ingredients</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Check if this is a thinking message - show with loading animation
    if (currentMessage?.messageType === MESSAGE_TYPE_THINKING) {
      return (
        <View style={styles.thinkingBubble}>
          <ActivityIndicator size="small" color="#2bb673" style={{ marginRight: 8 }} />
          <Bubble
            {...props}
            wrapperStyle={{
              left: styles.thinkingBubbleWrapper,
            }}
            textStyle={{
              left: styles.thinkingBubbleText,
            }}
          />
        </View>
      );
    }
    
    // Default bubble
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          left: styles.botBubbleWrapper,
          right: styles.userBubbleWrapper,
        }}
        textStyle={{
          left: styles.botBubbleText,
          right: styles.userBubbleText,
        }}
      />
    );
  }, [handleConfirm, handleAddMoreChoice, handleDietaryAlternativeChoice]);

  return (
    <View style={{ flex: 1 }}>
      {/* Debug controls */}
      {SHOW_DEBUG && (
        <View style={styles.debugBar}>
          <Text style={styles.debugLabel}>DEBUG MODE</Text>
          <TouchableOpacity style={styles.debugBtn} onPress={quickTest}>
            <Text style={styles.debugBtnText}>🧪 Quick Test</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.debugBtn} onPress={manualSend}>
            <Text style={styles.debugBtnText}>📤 Manual Send</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <GiftedChat 
        messages={messages} 
        onSend={(msgs) => {
          console.log('📩 GiftedChat onSend callback fired');
          onSend(msgs as ExtendedMessage[]);
        }} 
        user={{ _id: 1 }} 
        isTyping={isTyping}
        alwaysShowSend={!hasActiveConfirmation}
        text={inputText}
        onInputTextChanged={setInputText}
        renderBubble={renderBubble}
        renderTime={(props) => {
          const { currentMessage } = props;
          if (!currentMessage?.createdAt) return null;
          const date = currentMessage.createdAt instanceof Date 
            ? currentMessage.createdAt 
            : new Date(currentMessage.createdAt);
          return (
            <View style={{ paddingHorizontal: 10, paddingBottom: 5 }}>
              <Text style={{ fontSize: 10, color: '#8e8e8e' }}>
                {formatToPHT(date)}
              </Text>
            </View>
          );
        }}
        textInputProps={{
          editable: !hasActiveConfirmation,
          placeholder: hasActiveConfirmation 
            ? 'Please select an option above...' 
            : 'Type your ingredients...'
        }}
        renderInputToolbar={() => (
          <View style={styles.inputToolbar}>
            <View style={styles.composerRow}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={hasActiveConfirmation ? 'Please select an option above...' : 'Type your ingredients...'}
                placeholderTextColor="#999"
                style={styles.composerInput}
                editable={!hasActiveConfirmation}
              />
              {!hasActiveConfirmation && inputText.trim() ? (
                <TouchableOpacity
                  style={styles.sendContainer}
                  onPress={() => {
                    console.log('ðŸŸ¢ Custom Send button pressed');
                    if (inputText.trim()) {
                      const message: ExtendedMessage = {
                        _id: Math.random().toString(36).substring(2),
                        text: inputText.trim(),
                        createdAt: new Date(),
                        user: { _id: 1 },
                      };
                      onSend([message]);
                      Keyboard.dismiss();
                    }
                  }}
                >
                  <View style={styles.sendButton}>
                    <Text style={styles.sendButtonText}>Send</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  debugBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 8,
    backgroundColor: '#fff3cd',
    borderBottomWidth: 1,
    borderColor: '#ffc107',
    gap: 8,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#856404',
    marginRight: 8,
  },
  debugBtn: {
    backgroundColor: '#007bff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  debugBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
    paddingBottom: 0,
    height: 44,
  },
  sendButton: {
    width: 56,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#79d2a2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  inputToolbar: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderTopWidth: 0,
    backgroundColor: '#ececec',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inputToolbarPrimary: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    fontSize: 15,
    color: '#000000',
  },
  // Bubble styles
  botBubbleWrapper: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 2,
  },
  botBubbleText: {
    color: '#333',
  },
  userBubbleWrapper: {
    backgroundColor: '#2bb673',
    borderRadius: 16,
  },
  userBubbleText: {
    color: '#fff',
  },
  // Confirmation bubble with Yes/No buttons inside
  confirmationBubble: {
    marginBottom: 10,
    marginLeft: 10,
    width: CHAT_BUBBLE_WIDTH, // Use exact screen-based width
  },
  confirmButtonsInBubble: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
    width: CHAT_BUBBLE_WIDTH, // Match parent width
  },
  confirmButtonsColumn: {
    marginTop: 10,
    gap: 8,
    width: CHAT_BUBBLE_WIDTH, // Match exact bubble width
  },
  fullWidthBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    width: CHAT_BUBBLE_WIDTH, // Match exact bubble width
    alignItems: 'center',
  },
  fullWidthBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inBubbleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1, // Each button takes equal width
    minWidth: (CHAT_BUBBLE_WIDTH - 10) / 2, // Half bubble width minus gap
    alignItems: 'center',
  },
  yesBtn: {
    backgroundColor: '#2bb673',
  },
  noBtn: {
    backgroundColor: '#e74c3c',
  },
  addMoreBtn: {
    backgroundColor: '#3b82f6',
  },
  startFreshBtn: {
    backgroundColor: '#8b5cf6',
  },
  recommendBtn: {
    backgroundColor: '#f59e0b',
  },
  inBubbleBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Thinking bubble with loading animation
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 10,
  },
  thinkingBubbleWrapper: {
    backgroundColor: '#e8f5e9',
    borderRadius: 16,
  },
  thinkingBubbleText: {
    color: '#2bb673',
    fontStyle: 'italic',
  },
});

export default ChatScreen;
