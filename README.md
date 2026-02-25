# KainAI 🍳
### Your AI-Powered Culinary Assistant

KainAI is a cross-platform mobile application built with React Native (Expo) and Firebase. It bridges the gap between AI-driven recipe generation and social cooking experiences.

---

## ✨ Features

### 🤖 AI Chat & Recipe Generation
- **Ingredient-Based Recipes**: Input your available ingredients and receive custom-tailored recipes
- **Conversational Chef**: Chat with Cheffy, your AI chef assistant powered by Llama 3.3
- **Dietary Awareness**: Automatically detects and flags ingredient conflicts with your dietary preferences and allergies
- **Instant Archiving**: Generated recipes are automatically saved to your personal log

### 👤 Personalized Profiles
- **Onboarding Flow**: Set your name, dietary preferences, allergies, and cooking level on first launch
- **Edit Profile**: Update your preferences anytime — pill selections sync across the app
- **Dietary Enforcement**: Every recipe respects your saved dietary restrictions

### 🎮 Gamified Experience (Beta)
- **Chef Levels**: Progress from Beginner to Master by completing recipes
- **XP System**: Earn XP for generating and completing recipes
- **Achievement System**: Unlock badges like "Ingredient Master" and "Streak Master"
- **Rewards Tier**: Interactive 3-tier tracking for weekly goals and instant XP boosts

### 👨‍🍳 Interactive Cooking Mode
- **Step-by-Step Tracking**: Persistent checklists that save your progress
- **Nutritional Insights**: Real-time estimates for calories, protein, carbs, and fats
- **Completion Flow**: Mark recipes as done and share directly to the community

### 🤝 Community & Social
- **Shared Creations**: Post your successful meals to the public feed
- **Leaderboard**: See top chefs ranked by XP
- **Social Indicators**: Bookmark recipes and see what others are cooking

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo Router) |
| Backend | Node.js + Express |
| Database | Firebase Firestore |
| Auth | Firebase Auth + Google Sign-In |
| AI | Groq API (Llama 3.3 70B) |
| State | React Context + Hooks |

---

## 📂 Project Structure

```
KainAI/
├── app/
│   ├── (tabs)/
│   │   ├── onboarding/       # Onboarding flow (step1-5, endstep)
│   │   ├── community_section/
│   │   ├── legal_and_info_section/
│   │   └── privacy_and_data_section/
│   ├── edit-profile.tsx
│   └── Login.tsx
├── components/               # Reusable UI components
├── contexts/                 # AuthContext, UserContext
├── services/                 # userService, XP tracking, filtering
└── server/                   # Express API + Groq integration
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install
cd server && npm install

# Run the app
npx expo run:android

# Run the server
node server/server.js

# Connect Android device
adb reverse tcp:5173 tcp:5173
```

---

## 🔒 Privacy & Compliance
User data safety is a priority. Health & Nutrition and Data Sharing disclosures are explicitly integrated into the app with transparent legal constraints regarding AI estimates and public posting.

---

## ⚠️ Known Issues
- None currently open
