# 🟦 Time Tetris

**A visual time tracker that turns your day into a colorful grid — like Tetris, but for your life.**

Built for people who want to understand where their time actually goes, not just where they *planned* for it to go. Log entries by voice, text, or tap. Get AI-powered insights. Build habits. Reflect daily.

> Inspired by a paper grid system. Powered by AI. Lives entirely on your phone.

---

## ✨ What it does

| Feature | Description |
|--------|-------------|
| 🟦 **Time Grid** | Your day as 48 × 30-min blocks, color-coded by category. See your day at a glance. |
| 🎙️ **Voice Entry** | "I took a nap for the last hour and a half" → logged instantly via Whisper AI |
| ⌨️ **Text Entry** | Type anything natural. AI figures out the time, category, and duration. |
| 📊 **Insights** | Daily breakdown, Eisenhower matrix (urgent vs important), weekly trends |
| 🎯 **Habit Tracker** | Daily habit checklist. Habits auto-complete when linked categories are logged. |
| 📓 **Journal** | Morning intentions + evening wins + mood. AI reflects on your whole day. |
| 🎨 **Categories** | Fully customizable — name, color, emoji, Eisenhower quadrant |

---

## 📱 Try it yourself (no install needed)

The app runs on **Expo Go** — no App Store required.

### Step 1 — Install Expo Go
- iPhone: [App Store → Expo Go](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Play Store → Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Step 2 — Clone and run
```bash
git clone https://github.com/YOUR_USERNAME/time-tetris.git
cd time-tetris
npm install
npx expo start --tunnel
```

### Step 3 — Open on your phone
- Open **Expo Go** on your phone
- Scan the QR code shown in the terminal
- The app loads instantly ✅

> **Having trouble with QR?** Log into the same Expo account on both your computer (`npx expo login`) and the Expo Go app. Your project will appear automatically.

---

## 🤖 AI Features Setup (Optional)

Voice entry, text parsing, and AI insights use [Groq](https://console.groq.com) — a free AI API.

1. Sign up free at [console.groq.com](https://console.groq.com)
2. Create an API key (takes 30 seconds)
3. Open the app → tap the ⚙️ gear icon → paste your key
4. That's it. Voice and AI features unlock immediately.

**Free tier is generous** — thousands of requests/month. Your key is stored only on your device (iOS Keychain / Android Keystore). Never sent anywhere except directly to Groq.

> Don't want to set up a key? The app works fully without it — you just get manual entry instead of AI parsing and no AI insights.

---

## 🧠 How the AI works

```
Your voice / text
      ↓
Groq Whisper (speech-to-text, if voice)
      ↓
Groq llama-3.3-70b (parse → start time, end time, category)
      ↓
Saved to local SQLite on your phone
```

Everything is **local-first**. No account. No cloud sync. No data leaves your device except the text sent to Groq for parsing (and only if you set up a key).

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React Native + Expo SDK 54 |
| Navigation | expo-router (file-based) |
| Storage | expo-sqlite (local SQLite) |
| State | Zustand |
| AI Parsing | Groq API — llama-3.3-70b-versatile |
| Voice | expo-av + Groq Whisper |
| Secure storage | expo-secure-store (Keychain/Keystore) |
| Language | TypeScript |

---

## 📂 Project Structure

```
time-tetris/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Time grid (main screen)
│   │   ├── habits.tsx         # Habit tracker
│   │   ├── journal.tsx        # Morning/evening journal
│   │   ├── categories.tsx     # Category management
│   │   └── insights.tsx       # Analytics + AI review
│   ├── entry-modal.tsx        # Voice/text/quick entry
│   ├── category-edit.tsx      # Category editor
│   └── settings.tsx           # API key + preferences
├── src/
│   ├── services/
│   │   ├── database.ts        # SQLite CRUD
│   │   ├── nlpParser.ts       # Groq text parsing
│   │   ├── voiceRecorder.ts   # Audio + Whisper
│   │   ├── analytics.ts       # Stats + CSV export
│   │   └── insightGenerator.ts # AI daily review
│   ├── stores/                # Zustand state
│   ├── constants/             # Colors, categories, prompts
│   ├── types/                 # TypeScript interfaces
│   └── utils/                 # Time helpers
```

---

## 🗺️ Roadmap

- [x] v1.0 — Time grid, categories, manual entry
- [x] v1.2 — Voice entry, AI text parsing, insights, CSV export
- [x] v2.0 — Habit tracker, morning/evening journal, AI day reflection
- [ ] v2.1 — Better onboarding, app icon refresh, design polish
- [ ] v3.0 — Backend + cloud sync (optional), App Store release

---

## 🤝 Contributing

This is a personal project but PRs and issues are welcome! If you try it and hit a bug, open an issue with your phone model and what happened.

---

## 📄 License

MIT — do whatever you want with it.

---

*Built with ❤️ and too many late nights by [@devyanshi](https://github.com/YOUR_USERNAME)*
