// components/RecipeDetail.tsx - Recipe detail view with cooking mode
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Recipe, Ingredient, Instruction, CookingProgress } from '../types';
import recipeService from '../services/recipe.service';

const screenW = Dimensions.get('window').width;

interface RecipeDetailProps {
  recipe: Recipe;
  userId: string;
  onClose: () => void;
  onRecipeComplete: (recipe: Recipe, rating: number) => void;
  onSaveToArchive?: (recipe: Recipe) => void;
  onRecipeShared?: (recipe: Recipe) => void;
}

export function RecipeDetail({
  recipe: initialRecipe,
  userId,
  onClose,
  onRecipeComplete,
  onSaveToArchive,
  onRecipeShared,
}: RecipeDetailProps) {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [cookingMode, setCookingMode] = useState(false);
  const [cookingProgress, setCookingProgress] = useState<CookingProgress>({
    currentStep: -1,
    completedSteps: [],
    startedAt: null,
    completedAt: null,
  });
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isSharing, setIsSharing] = useState(false);

  // Check if user owns this recipe
  const isOwner = recipe.userId === userId;
  const canShare = isOwner && !recipe.isPublic;
  const canUnshare = isOwner && recipe.isPublic;

  // Handle sharing recipe to community
  const handleShareToCommunity = async () => {
    if (!canShare) return;

    Alert.alert(
      'Share to Community',
      'Share this recipe with the KainAI community? You\'ll earn 15 reward points!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            try {
              setIsSharing(true);
              const result = await recipeService.shareRecipeToCommunity(recipe.id, userId);
              
              if (result.success) {
                // Update local state
                setRecipe(prev => ({ ...prev, isPublic: true, sharedAt: new Date() }));
                
                Alert.alert(
                  'Shared!',
                  `Your recipe is now visible to the community. You earned ${result.pointsAwarded} reward points!`
                );

                // Notify parent
                onRecipeShared?.(recipe);
              } else {
                Alert.alert('Error', result.error || 'Failed to share recipe');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to share recipe');
            } finally {
              setIsSharing(false);
            }
          },
        },
      ]
    );
  };

  // Handle making recipe private again
  const handleMakePrivate = async () => {
    if (!canUnshare) return;

    Alert.alert(
      'Make Private',
      'Remove this recipe from the community? Others will no longer be able to see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Private',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSharing(true);
              const result = await recipeService.unshareRecipe(recipe.id, userId);
              
              if (result.success) {
                // Update local state
                setRecipe(prev => ({ ...prev, isPublic: false }));
                Alert.alert('Done', 'Your recipe is now private.');
              } else {
                Alert.alert('Error', result.error || 'Failed to make recipe private');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to make recipe private');
            } finally {
              setIsSharing(false);
            }
          },
        },
      ]
    );
  };

  // Reset state when recipe changes (fixes shared state bug)
  useEffect(() => {
    setRecipe(initialRecipe);
    setCookingMode(false);
    setShowRatingModal(false);
    setSelectedRating(0);
    
    // If recipe is already Done, show completed state with all steps marked
    if (initialRecipe.status === 'Done') {
      setCookingProgress({
        currentStep: initialRecipe.instructions.length - 1,
        completedSteps: initialRecipe.instructions.map((_, i) => i),
        startedAt: null,
        completedAt: initialRecipe.cookingProgress?.completedAt || new Date(),
      });
    } else {
      // Reset progress and try to load any saved progress
      setCookingProgress({
        currentStep: -1,
        completedSteps: [],
        startedAt: null,
        completedAt: null,
      });
      loadSavedProgress();
    }
  }, [initialRecipe.id, initialRecipe.status]);

  const loadSavedProgress = async () => {
    const savedProgress = await recipeService.getCookingProgress(userId, recipe.id);
    if (savedProgress && !savedProgress.completedAt) {
      setCookingProgress(savedProgress);
      // If there's active progress, auto-enter cooking mode
      if (savedProgress.startedAt) {
        setCookingMode(true);
      }
    }
  };

  const startCookingMode = async () => {
    await recipeService.startCookingMode(userId, recipe.id);
    setCookingProgress({
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      completedAt: null,
    });
    setCookingMode(true);
  };

  const toggleStepComplete = async (stepIndex: number) => {
    // Bug 2 fix: Enforce sequential step completion
    // Can only complete the next step in sequence, or toggle off a completed step
    const isAlreadyCompleted = cookingProgress.completedSteps.includes(stepIndex);
    
    if (!isAlreadyCompleted) {
      // Check if this is the next step in sequence
      const expectedNextStep = cookingProgress.completedSteps.length;
      if (stepIndex !== expectedNextStep) {
        // Can't skip steps - show alert
        Alert.alert(
          'Complete steps in order',
          `Please complete step ${expectedNextStep + 1} first before moving to step ${stepIndex + 1}.`
        );
        return;
      }
    } else {
      // Unchecking a step - only allow unchecking the last completed step
      const lastCompletedStep = Math.max(...cookingProgress.completedSteps);
      if (stepIndex !== lastCompletedStep) {
        Alert.alert(
          'Cannot uncheck this step',
          'You can only uncheck the most recently completed step.'
        );
        return;
      }
    }
    
    const newProgress = await recipeService.toggleStepCompletion(
      userId,
      recipe.id,
      stepIndex,
      cookingProgress
    );
    setCookingProgress(newProgress);

    // Check if all steps are complete
    if (newProgress.completedSteps.length === recipe.instructions.length) {
      // All steps done - show completion prompt after a small delay
      setTimeout(() => {
        setShowRatingModal(true);
      }, 500);
    }
  };

  const handleFinishCooking = async () => {
    if (selectedRating === 0) {
      Alert.alert('Rate your dish', 'Please give your creation a star rating!');
      return;
    }

    const result = await recipeService.completeRecipe(userId, recipe.id, selectedRating);
    
    if (result.success) {
      setShowRatingModal(false);
      setCookingMode(false);
      
      // Update local recipe state
      setRecipe(prev => ({
        ...prev,
        status: 'Done',
        userRating: selectedRating,
      }));

      // Notify parent - this will trigger the share prompt
      onRecipeComplete(recipe, selectedRating);

      // Show level up notification if applicable
      if (result.newLevel) {
        Alert.alert(
          '🎉 Level Up!',
          `Congratulations! You're now a ${result.newLevel}!`
        );
      }
    }
  };

  const isStepCompleted = (index: number) => cookingProgress.completedSteps.includes(index);
  const allStepsCompleted = cookingProgress.completedSteps.length === recipe.instructions.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
<AntDesign name="left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {/* Delete button */}
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => {
              Alert.alert(
                'Delete Recipe',
                'Are you sure you want to delete this recipe? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await recipeService.deleteRecipe(userId, recipe.id);
                        Alert.alert('Deleted', 'Recipe has been deleted.');
                        onClose();
                      } catch (error: any) {
                        Alert.alert('Error', error.message || 'Failed to delete recipe');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Feather name="trash-2" size={22} color="#ff4444" />
          </TouchableOpacity>
          {recipe.status !== 'Done' && onSaveToArchive && (
            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={() => onSaveToArchive(recipe)}
            >
              <Feather name="bookmark" size={22} color="#ff8a3d" />
            </TouchableOpacity>
          )}
          {/* Share to Community Button */}
          {isSharing ? (
            <View style={styles.shareBtn}>
              <ActivityIndicator size="small" color="#2bb673" />
            </View>
          ) : canShare ? (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareToCommunity}>
              <Feather name="share" size={22} color="#2bb673" />
            </TouchableOpacity>
          ) : canUnshare ? (
            <TouchableOpacity style={styles.shareBtn} onPress={handleMakePrivate}>
              <Feather name="lock" size={22} color="#f59e0b" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.shareBtn} disabled>
              <Feather name="share" size={22} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recipe Title & Meta */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{recipe.title}</Text>
            <View style={styles.ratingBadge}>
              <AntDesign name="star" size={14} color="#f59e0b" />
              <Text style={styles.ratingText}>
                {recipe.userRating || '4.8'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.description}>{recipe.description}</Text>

          {/* Status Badge */}
          {recipe.status !== 'Not Started' && (
            <View style={[
              styles.statusBadge,
              recipe.status === 'Done' ? styles.statusDone : styles.statusInProgress
            ]}>
              <Text style={styles.statusText}>
                {recipe.status === 'Done' ? '✓ Completed' : '🍳 In Progress'}
              </Text>
            </View>
          )}

          {/* Public/Private Status Badge */}
          {isOwner && (
            <View style={[
              styles.statusBadge,
              recipe.isPublic ? styles.statusPublic : styles.statusPrivate
            ]}>
              <Feather 
                name={recipe.isPublic ? 'globe' : 'lock'} 
                size={12} 
                color={recipe.isPublic ? '#22c55e' : '#6b7280'} 
              />
              <Text style={[
                styles.statusText,
                { color: recipe.isPublic ? '#22c55e' : '#6b7280', marginLeft: 4 }
              ]}>
                {recipe.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Info */}
        <View style={styles.metaRow}>
          {recipe.prepTime ? (
            <MetaItem icon="clock-circle" label="Prep" value={`${recipe.prepTime} mins`} />
          ) : null}
          <MetaItem icon="clock-circle" label="Cook" value={`${recipe.cookTime} mins`} />
          {recipe.totalTime ? (
            <MetaItem icon="clock-circle" label="Total" value={`${recipe.totalTime} mins`} />
          ) : null}
          <MetaItem icon="team" label="Servings" value={`${recipe.servings}`} />
          <MetaItem icon="trophy" label="Difficulty" value={recipe.difficulty} />
          <MetaItem icon="fire" label="Calories" value={`${recipe.calories}`} />
        </View>

        {/* Tags */}
        <View style={styles.tagRow}>
          {recipe.tags.map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Ingredients Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧂 Ingredients</Text>
          {renderIngredientsByCategory(recipe.ingredients)}
        </View>

        {/* Instructions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Instructions</Text>
          {recipe.instructions.map((instruction, index) => {
            const nextStepIndex = cookingProgress.completedSteps.length;
            const isNextStep = cookingMode && index === nextStepIndex;
            const isLocked = cookingMode && index > nextStepIndex && !isStepCompleted(index);
            
            return (
              <InstructionStep
                key={`${recipe.id}-step-${index}`}
                instruction={instruction}
                isCompleted={isStepCompleted(index)}
                isNextStep={isNextStep}
                isLocked={isLocked}
                isCookingMode={cookingMode}
                onToggle={() => toggleStepComplete(index)}
              />
            );
          })}
        </View>

        {/* Nutrition Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Nutrition Information</Text>
          <View style={styles.nutritionRow}>
            <NutritionItem label="Calories" value={recipe.nutrition.calories} unit="" color="#ef4444" />
            <NutritionItem label="Protein" value={recipe.nutrition.protein} unit="g" color="#3b82f6" />
            <NutritionItem label="Carbs" value={recipe.nutrition.carbs} unit="g" color="#f59e0b" />
            <NutritionItem label="Fat" value={recipe.nutrition.fat} unit="g" color="#22c55e" />
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      {recipe.status !== 'Done' && (
        <View style={styles.bottomAction}>
          {!cookingMode ? (
            <TouchableOpacity style={styles.startCookingBtn} onPress={startCookingMode}>
              <MaterialCommunityIcons name="chef-hat" size={20} color="#fff" />
              <Text style={styles.startCookingText}>Start Cooking Mode</Text>
            </TouchableOpacity>
          ) : allStepsCompleted ? (
            <TouchableOpacity 
              style={[styles.startCookingBtn, styles.finishBtn]} 
              onPress={() => setShowRatingModal(true)}
            >
              <AntDesign name="check-circle" size={20} color="#fff" />
              <Text style={styles.startCookingText}>Finish & Rate</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {cookingProgress.completedSteps.length} / {recipe.instructions.length} steps completed
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎉 Amazing job!</Text>
            <Text style={styles.modalSubtitle}>How did your dish turn out?</Text>
            
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity 
                  key={star} 
                  onPress={() => setSelectedRating(star)}
                >
                  <MaterialCommunityIcons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={36}
                    color="#f59e0b"
                    style={styles.starIcon}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={handleFinishCooking}>
              <Text style={styles.modalBtnText}>Complete Recipe</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCancelBtn} 
              onPress={() => setShowRatingModal(false)}
            >
              <Text style={styles.modalCancelText}>Continue Cooking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Helper Components

function MetaItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <AntDesign name={icon as any} size={18} color="#666" />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function renderIngredientsByCategory(ingredients: Ingredient[]) {
  const grouped: Record<string, Ingredient[]> = {};
  
  ingredients.forEach(ing => {
    const cat = ing.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ing);
  });

  const categoryColors: Record<string, string> = {
    Protein: '#ef4444',
    Grain: '#f59e0b',
    Vegetable: '#22c55e',
    Seasoning: '#8b5cf6',
    Other: '#6b7280',
  };

  return Object.entries(grouped).map(([category, items]) => (
    <View key={category} style={styles.ingredientCategory}>
      <View style={[styles.categoryBadge, { backgroundColor: categoryColors[category] + '20' }]}>
        <Text style={[styles.categoryText, { color: categoryColors[category] }]}>{category}</Text>
      </View>
      {items.map((ing, i) => (
        <View key={i} style={styles.ingredientRow}>
          <View style={[styles.ingredientDot, { backgroundColor: categoryColors[category] }]} />
          <Text style={styles.ingredientText}>
            {ing.amount} {ing.unit} {ing.name}
            {ing.notes ? ` (${ing.notes})` : ''}
          </Text>
        </View>
      ))}
    </View>
  ));
}

function InstructionStep({
  instruction,
  isCompleted,
  isNextStep,
  isLocked,
  isCookingMode,
  onToggle,
}: {
  instruction: Instruction;
  isCompleted: boolean;
  isNextStep?: boolean;
  isLocked?: boolean;
  isCookingMode: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.instructionCard,
        isCompleted && styles.instructionCompleted,
        isNextStep && styles.instructionNextStep,
        isLocked && styles.instructionLocked,
      ]}
      onPress={isCookingMode ? onToggle : undefined}
      activeOpacity={isCookingMode && !isLocked ? 0.7 : 1}
    >
      <View style={styles.instructionHeader}>
        <View style={[
          styles.stepNumber,
          isCompleted && styles.stepNumberCompleted,
          isNextStep && styles.stepNumberNext,
          isLocked && styles.stepNumberLocked,
        ]}>
          {isCompleted ? (
            <AntDesign name="check" size={14} color="#fff" />
          ) : isLocked ? (
            <AntDesign name="lock" size={12} color="#999" />
          ) : (
            <Text style={[styles.stepNumberText, isNextStep && styles.stepNumberTextNext]}>
              {instruction.stepNumber}
            </Text>
          )}
        </View>
        {isNextStep && (
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>NEXT</Text>
          </View>
        )}
        {instruction.timeMinutes && (
          <View style={styles.stepTime}>
<Feather name="clock" size={12} color={isLocked ? "#ccc" : "#666"} />
            <Text style={[styles.stepTimeText, isLocked && styles.lockedText]}>
              {instruction.timeMinutes} mins
            </Text>
          </View>
        )}
      </View>
      
      <Text style={[
        styles.instructionText,
        isCompleted && styles.instructionTextCompleted,
        isLocked && styles.instructionTextLocked,
      ]}>
        {instruction.text}
      </Text>

      {instruction.tip && (
        <View style={[styles.tipBox, isLocked && styles.tipBoxLocked]}>
          <Text style={[styles.tipText, isLocked && styles.lockedText]}>💡 Tip: {instruction.tip}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function NutritionItem({ 
  label, 
  value, 
  unit, 
  color 
}: { 
  label: string; 
  value: number; 
  unit: string; 
  color: string;
}) {
  return (
    <View style={styles.nutritionItem}>
      <Text style={[styles.nutritionValue, { color }]}>{value}{unit}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff7f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteBtn: {
    padding: 8,
  },
  saveBtn: {
    padding: 8,
  },
  shareBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleSection: {
    paddingVertical: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingRight: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5e6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    marginLeft: 4,
    fontWeight: '600',
    color: '#f59e0b',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  statusBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusInProgress: {
    backgroundColor: '#fff3cd',
  },
  statusDone: {
    backgroundColor: '#d4edda',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 1,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
    gap: 8,
  },
  tag: {
    backgroundColor: '#fff5f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffebe6',
  },
  tagText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  ingredientCategory: {
    marginBottom: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  ingredientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  ingredientText: {
    fontSize: 14,
    color: '#333',
  },
  instructionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2bb673',
    elevation: 1,
  },
  instructionCompleted: {
    backgroundColor: '#f0fdf4',
    borderLeftColor: '#22c55e',
    opacity: 0.8,
  },
  instructionNextStep: {
    borderLeftColor: '#f59e0b',
    borderLeftWidth: 6,
    backgroundColor: '#fffbeb',
  },
  instructionLocked: {
    backgroundColor: '#f5f5f5',
    borderLeftColor: '#d1d5db',
    opacity: 0.6,
  },
  instructionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2bb673',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: '#22c55e',
  },
  stepNumberNext: {
    backgroundColor: '#f59e0b',
  },
  stepNumberLocked: {
    backgroundColor: '#e5e7eb',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepNumberTextNext: {
    color: '#fff',
  },
  nextBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  nextBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  lockedText: {
    color: '#9ca3af',
  },
  instructionTextLocked: {
    color: '#9ca3af',
  },
  tipBoxLocked: {
    backgroundColor: '#f3f4f6',
  },
  stepTime: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepTimeText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  instructionTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  tipBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#92400e',
    fontStyle: 'italic',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    elevation: 1,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  startCookingBtn: {
    flexDirection: 'row',
    backgroundColor: '#ff8a3d',
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  finishBtn: {
    backgroundColor: '#22c55e',
  },
  startCookingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressInfo: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: screenW - 48,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  starRow: {
    flexDirection: 'row',
    marginVertical: 24,
  },
  starIcon: {
    marginHorizontal: 4,
  },
  modalBtn: {
    backgroundColor: '#2bb673',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 8,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelBtn: {
    marginTop: 16,
    padding: 8,
  },
  modalCancelText: {
    color: '#666',
    fontSize: 14,
  },
  // Recipe sharing status badge styles
  statusPublic: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusPrivate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
});

export default RecipeDetail;
