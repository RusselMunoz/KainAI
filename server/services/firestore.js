// services/firestore.js
const admin = require('firebase-admin');

// Add a new user to Firestore
async function addUser(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required.');
  }
  const docRef = await admin.firestore().collection('users').add({
    username: name.trim(),
    created_at: new Date(),
    is_active: true
  });
  return docRef.id;
}

async function addDietaryPreference(userId, preference) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }
  const userRef = admin.firestore().collection('users').doc(userId.trim());
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }
  await userRef.update({
    dietary_preferences: admin.firestore.FieldValue.arrayUnion(preference)
  });
  return true;
}
async function addDietaryAllergyPreference(userId, allergy) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }
  const userRef = admin.firestore().collection('users').doc(userId.trim());
  const userDoc = await userRef.get(); 
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }
  await userRef.update({
    dietary_allergies: admin.firestore.FieldValue.arrayUnion(allergy)
  });
  return true;
}

async function addCookingSkill(userId, cooking_skill) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }
  const userRef = admin.firestore().collection('users').doc(userId.trim());
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }
  await userRef.update({
    cooking_skills: admin.firestore.FieldValue.arrayUnion(cooking_skill)
  });
  return true;
}


// Retrieve user data (preferences, allergies, skill) from Firestore
async function getUserData(userId) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    // Return default data for missing userId
    console.log('No userId provided, returning defaults');
    return {
      dietary_preferences: [],
      dietary_allergies: [],
      cooking_skills: [],
    };
  }
  const userRef = admin.firestore().collection('users').doc(userId.trim());
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    // Return default data for non-existent user instead of throwing
    console.log(`User ${userId} not found, returning defaults`);
    return {
      dietary_preferences: [],
      dietary_allergies: [],
      cooking_skills: [],
    };
  }
  const data = userDoc.data();
  return {
    dietary_preferences: data.dietary_preferences || [],
    dietary_allergies: data.dietary_allergies || [],
    cooking_skills: data.cooking_skills || [],
    ...data
  };
}

// Update user data in Firestore
async function updateUserData(userId, updates) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }
  
  const userRef = admin.firestore().collection('users').doc(userId.trim());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error('User not found.');
  }
  
  // Filter out undefined values and add updated_at timestamp
  const filteredUpdates = {};
  const allowedFields = [
    'displayName', 'username', 'bio', 'photoURL',
    'dietary_preferences', 'dietary_allergies', 'dietary_custom', 'allergy_custom',
    'cooking_skills', 'onboardingComplete', 'level', 'xp',
    'recipesCompleted', 'postsCreated', 'totalLikesReceived', 'totalSaves'
  ];
  
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }
  
  if (Object.keys(filteredUpdates).length === 0) {
    console.log('No valid fields to update');
    return userDoc.data();
  }
  
  // Add updated_at timestamp
  filteredUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();
  
  await userRef.update(filteredUpdates);
  
  // Return the updated user data
  const updatedDoc = await userRef.get();
  return updatedDoc.data();
}

module.exports = {
  addUser,
  addDietaryPreference,
  addDietaryAllergyPreference,
  addCookingSkill,
  getUserData,
  updateUserData
};
