// services/firestore.js
const admin = require('firebase-admin');

// Try to derive an email from whatever metadata the caller provided.
function extractEmailFromMetadata(userData) {
  if (!userData) return null;

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const prioritized = [];
  const fallback = [];
  const seen = new Set();

  const pushCandidate = (value, target) => {
    if (typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    target.push(trimmed);
  };

  const visit = (value, depth = 0) => {
    if (value == null || depth > 5) {
      return;
    }
    if (typeof value === 'string') {
      pushCandidate(value, fallback);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((val) => visit(val, depth + 1));
    }
  };

  if (typeof userData === 'string') {
    pushCandidate(userData, prioritized);
  } else if (typeof userData === 'object') {
    pushCandidate(userData.email, prioritized);
    pushCandidate(userData.emailAddress, prioritized);
    pushCandidate(userData.user?.email, prioritized);
    pushCandidate(userData.user?.emailAddress, prioritized);
    pushCandidate(userData.profile?.email, prioritized);
    pushCandidate(userData.metadata?.email, prioritized);
    pushCandidate(userData.metadata?.user?.email, prioritized);
    pushCandidate(userData.metadata?.profile?.email, prioritized);
    pushCandidate(userData.auth?.email, prioritized);
    pushCandidate(userData.auth?.token?.email, prioritized);
    pushCandidate(userData.auth?.token?.emailAddress, prioritized);
    visit(userData);
  }

  return prioritized[0] || fallback[0] || null;
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
  const metadataPayload = (userData && typeof userData === 'object') ? userData : { raw: userData };
  try {
    console.log('[ensureUserExists] Received metadata:', JSON.stringify(metadataPayload, null, 2));
  } catch (error) {
    console.log('[ensureUserExists] Unable to stringify metadata payload:', error.message);
  }
  const userRef = admin.firestore().collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    return userDoc.data();
  }

  const normalizedMetadata = (metadataPayload && typeof metadataPayload === 'object') ? { ...metadataPayload } : {};

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

  const extractedEmail = extractEmailFromMetadata(metadataPayload);

  const resolvedEmail =
    (typeof email === 'string' && email.trim())
      ? email.trim()
      : (metadataEmail || extractedEmail);

  console.log('[ensureUserExists] Extracted email:', resolvedEmail || 'NOT FOUND');

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
