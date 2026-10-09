# Kubo - Family Organizer 🏡

Kubo is a local-first family household application designed to keep your family's essential information organized, private, and fully accessible offline. From medicine intake schedules and grocery lists to debt tracking and shared calendars, Kubo acts as your family's digital home base.

Because Kubo runs its AI and database directly on your device (phone, tablet, or laptop), your household's sensitive data stays completely private. It continues working flawlessly even when you have zero internet connection.

## 🌟 Key Features

- **Medicine Tracking & OCR**: Keep track of daily maintenance meds and "as needed" (PRN) medicine stocks. Includes an on-device OCR feature that scans medicine labels and automatically prefills the name, dosage, and schedule.
- **Magic Add (Local AI Parsing)**: A sleek voice-enabled, natural language parser. Simply say or type "Bili gatas bukas" or "Meeting tomorrow with father at 6pm" and Kubo will intelligently categorize it into the correct grocery list, debt tracker, or calendar event.
- **Shared Calendar**: Mark crucial family events, meetings, and schedules.
- **Debt & Balance Tracker**: Easily log shared expenses, keep track of who owes who, and automatically calculate net balances across family members.
- **Grocery & Task Lists**: Keep track of shared tasks and household needs.
- **100% Offline Capable**: Built with a local-first architecture. It syncs when you have a connection, but never stops working when you don't.

## 🛠 Tech Stack

- **Frontend Core**: React, Vite, TypeScript
- **Styling**: Modern Vanilla CSS, TailwindCSS (utility support)
- **Local Database**: IndexedDB (managed via Dexie.js)
- **Local AI & ML**: `@xenova/transformers` (NLP parsing), `tesseract.js` (Optical Character Recognition)
- **Icons**: `lucide-react`

---

## 🚀 Local Development Setup

Follow these steps to run Kubo locally for reproduction, testing, or contributing to the codebase.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (comes with Node.js)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/kubohub.git
cd kubohub
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```

The app will start instantly. Open your browser and navigate to:
**http://localhost:5173** (or the port specified in your terminal).

### 4. Build for Production (Optional)
To create a production-ready optimized build:
```bash
npm run build
```
You can preview the built files locally using:
```bash
npm run preview
```

## 🧠 Local AI Notes for Testing
- The first time you use the **Magic Add** or **Medicine Scan** features, the app will automatically download the necessary lightweight machine learning models (like the ONNX model for text parsing and Tesseract language data for OCR) directly into your browser's local cache. 
- **Subsequent uses will be instantaneous and completely offline.**
- Ensure you have a stable connection during the very first run of these features so the models can cache successfully.
