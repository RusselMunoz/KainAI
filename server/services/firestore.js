// services/firestore.js
const admin = require('firebase-admin');

// Try to derive an email from whatever metadata the caller provided.
function extractEmailFromMetadata(userData) {
  if (!userData) return null;

  const candidates = [];
  const pushCandidate = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        candidates.push(trimmed);
      }
    }
  };

  if (typeof userData === 'string') {
    pushCandidate(userData);
  } else if (typeof userData === 'object') {
    pushCandidate(userData.email);
    pushCandidate(userData.emailAddress);
    pushCandidate(userData.user?.email);
    pushCandidate(userData.user?.emailAddress);
    pushCandidate(userData.profile?.email);
    pushCandidate(userData.metadata?.email);
    pushCandidate(userData.auth?.email);
    pushCandidate(userData.auth?.token?.email);
    pushCandidate(userData.auth?.token?.emailAddress);
  }

  return candidates[0] || null;
}

function sanitizeForFirestore(data) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([, value]) => value !== undefined)
  );
}

async function ensureUserExists(userId, userData = {}) {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('User ID is required.');
  }

  const uid = userId.trim();
  const userRef = admin.firestore().collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    return userDoc.data();
  }

  const normalizedMetadata = (userData && typeof userData === 'object') ? userData : {};

  const {
    dietary_preferences,
    dietary_allergies,
    cooking_skills,
    onboardingComplete,
    email,
    displayName,
    name,
    metadata: nestedMetadata,
    uid: _ignoredUid,
    created_at,
    updated_at,
    ...rest
  } = normalizedMetadata;

  const metadataEmail = (typeof nestedMetadata?.email === 'string' && nestedMetadata.email.trim())
    ? nestedMetadata.email.trim()
    : null;

  const resolvedEmail =
    (typeof email === 'string' && email.trim())
      ? email.trim()
      : (metadataEmail || extractEmailFromMetadata({ ...normalizedMetadata, metadata: nestedMetadata }));

  const resolvedDisplayName = displayName
    || name
    || nestedMetadata?.displayName
    || nestedMetadata?.name
    || null;

  const newUserData = sanitizeForFirestore({
    uid,
    email: resolvedEmail ?? null,
    displayName: resolvedDisplayName,
    created_at: created_at || admin.firestore.FieldValue.serverTimestamp(),
    dietary_preferences: Array.isArray(dietary_preferences) ? dietary_preferences : [],
    dietary_allergies: Array.isArray(dietary_allergies) ? dietary_allergies : [],
    cooking_skills: Array.isArray(cooking_skills) ? cooking_skills : [],
    onboardingComplete: typeof onboardingComplete === 'boolean' ? onboardingComplete : false,
    ...rest
  });

  console.log(`[Firestore] Creating user document for ${uid}`);
  await userRef.set(newUserData, { merge: true });
  console.log(`[Firestore] User ${uid} created`);

  const createdDoc = await userRef.get();
  return createdDoc.data();
}

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
  updateUserData,
  ensureUserExists
};
