# Cheffy: Your AI Culinary Assistant 🍳

Cheffy is a cross-platform mobile application built with **React Native (Expo)** and **Firebase**. It bridges the gap between AI-driven recipe generation and social cooking experiences.

## ✨ Features

### 🤖 AI Chatbot & Recipe Generation
* **Leftover Logic:** Input available ingredients and receive custom-tailored recipes.
* **Instant Archiving:** Generated recipes are automatically saved to your personal log.

### 🎮 Gamified Experience (XP & Rewards)
* **Chef Levels:** Progress from "Beginner" to "Master" by completing recipes.
* **Achievement System:** Unlock badges like "Ingredient Master" and "Streak Master."
* **Rewards Tier:** Interactive 3-tier tracking for weekly goals and instant XP boosts.

### 👨‍🍳 Interactive Cooking Mode
* **Step-by-Step Tracking:** Persistent checklists that save your progress.
* **Nutritional Insights:** Real-time estimates for calories, protein, carbs, and fats.
* **Completion Flow:** Mark recipes as "Done" and share them directly to the community.

### 🤝 Community & Social
* **Shared Creations:** Post your successful meals to the public feed.
* **Social Indicators:** Bookmark recipes and see what others are cooking.

## 🛠️ Technical Stack
- **Frontend:** React Native (Expo Router)
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State Management:** React Hooks & Services
- **Safety:** Custom client/server-side profanity filtering.

## 📂 Project Structure (Recent Overhaul)
The project recently underwent a major directory reorganization to improve scalability:
- `/app/(tabs)/legal_and_info_section`: Houses Privacy, Terms, and Licenses.
- `/app/(tabs)/privacy_and_data_section`: New home for Health Data and Data Sharing disclosures.
- `/services`: Centralized logic for XP tracking and content filtering.

## 📝 Privacy & Compliance
We prioritize user data safety. Our **Health & Nutrition** and **Data Sharing** disclosures are explicitly integrated into the app with bolded legal constraints to ensure transparency regarding AI estimates and public posting.

## 🚧 Known Issues (In Progress)
- **Auth:** Resolving Google Sign-In initialization bugs.
