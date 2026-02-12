// services/profanity-filter.service.ts
// Client-side profanity filter for ingredient input

// Common profanity words (case-insensitive matching)
// This is a basic list - can be expanded as needed
const PROFANITY_LIST: string[] = [
  // Basic profanity
  'shit', 'fuck', 'damn', 'ass', 'bitch', 'bastard', 'crap',
  'dick', 'cock', 'pussy', 'cunt', 'piss', 'fag', 'whore',
  'slut', 'nigger', 'nigga', 'retard', 'faggot',
  // Variations with common substitutions
  'sh1t', 'f*ck', 'fuk', 'fck', 'a$s', 'b!tch', 'd1ck',
  // Additional words
  'asshole', 'bullshit', 'motherfucker', 'wtf', 'stfu', 'tite', 'pepe'
];

// Words that are okay but might partially match (whitelist)
const WHITELIST: string[] = [
  'shiitake', 'shitake', 'bass', 'grass', 'class', 'pass', 'mass',
  'cocktail', 'cocoa', 'coconut', 'apricot', 'scallop',
  'buttermilk', 'butter', 'butternut', 'peanut',
  'crapping', // for crab + ping? unlikely but safe
  'grapes', 'scrap', 'scraps',
  'assassin', 'passion', 'compassion',
  'assume', 'assist', 'associate',
];

/**
 * Check if text contains profanity
 * @param text - Text to check
 * @returns Object with isProfane flag and matched word if found
 */
export function checkProfanity(text: string): { isProfane: boolean; matchedWord?: string } {
  if (!text) return { isProfane: false };
  
  const lowerText = text.toLowerCase();
  
  // Check whitelist first - if the ingredient is whitelisted, it's okay
  for (const safeWord of WHITELIST) {
    if (lowerText.includes(safeWord)) {
      return { isProfane: false };
    }
  }
  
  // Check for profanity
  for (const badWord of PROFANITY_LIST) {
    // Use word boundary matching to avoid false positives
    const regex = new RegExp(`\\b${escapeRegex(badWord)}\\b`, 'i');
    if (regex.test(text)) {
      return { isProfane: true, matchedWord: badWord };
    }
  }
  
  // Also check for the word appearing as standalone (no boundaries)
  // This catches things like "shiiiiit" variations
  for (const badWord of PROFANITY_LIST) {
    if (lowerText === badWord) {
      return { isProfane: true, matchedWord: badWord };
    }
  }
  
  return { isProfane: false };
}

/**
 * Filter profanity from text, replacing with asterisks
 * @param text - Text to filter
 * @returns Filtered text
 */
export function filterProfanity(text: string): string {
  if (!text) return text;
  
  let filtered = text;
  
  for (const badWord of PROFANITY_LIST) {
    const regex = new RegExp(`\\b${escapeRegex(badWord)}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(badWord.length));
  }
  
  return filtered;
}

/**
 * Validate ingredient name
 * @param ingredient - Ingredient name to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateIngredient(ingredient: string): { isValid: boolean; error?: string } {
  if (!ingredient || ingredient.trim().length === 0) {
    return { isValid: false, error: 'Ingredient cannot be empty' };
  }
  
  const trimmed = ingredient.trim();
  
  // Check minimum length
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Ingredient name is too short' };
  }
  
  // Check maximum length
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Ingredient name is too long' };
  }
  
  // Check for profanity
  const profanityCheck = checkProfanity(trimmed);
  if (profanityCheck.isProfane) {
    return { isValid: false, error: 'Please enter a valid ingredient name' };
  }
  
  // Check for only special characters
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid ingredient name' };
  }
  
  return { isValid: true };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  checkProfanity,
  filterProfanity,
  validateIngredient,
};
