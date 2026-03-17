# SignBridge Ghana 🤟

**SignBridge Ghana** is an AI-powered Ghana Sign Language (GSL) interpreter and dictionary system. It bridges the communication gap between the Deaf community in Ghana and the hearing public by providing real-time sign-to-speech and speech-to-sign translation services.

---

## 🌟 Project Overview

This project is a full-stack web application designed to facilitate seamless communication using Ghana Sign Language. It leverages modern AI techniques, including pose estimation (MediaPipe) and large language models (Gemini), to interpret signs and transcribe speech. The system is optimized for performance and accessibility, featuring a modern, user-centric interface.

### Key Capabilities:
- **Sign-to-Speech**: Real-time interpretation of GSL signs into text and audible speech.
- **Speech-to-Sign**: Transcription of spoken English into a sequence of GSL dictionary diagrams.
- **Interactive Dictionary**: A searchable database of over 1,700 GSL signs with detailed diagrams and descriptions.
- **AI Chatbot**: An integrated assistant to help users learn GSL and navigate the platform.
- **Accessibility-First**: Built-in support for high contrast, large text, and visual feedback.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Icons**: Lucide React
- **3D Rendering**: Three.js (for avatar visualization)

### Backend
- **Framework**: FastAPI (Python)
- **AI/ML**: MediaPipe (Landmarks), Google GenAI (Gemini 2.0), Whisper (Speech-to-Text)
- **Database**: SQLite with SQLAlchemy ORM
- **Processing**: NumPy, SciPy (DTW matching), Pillow (Image processing)

### Infrastructure
- **Hosting**: Render (Web Service + Static Assets)
- **Environment**: Linux (Production), Windows/macOS/Linux (Development)

---

## 📂 Folder Structure

```text
/
├── api/                    # FastAPI Backend Application
│   ├── database/           # Database models, connection, and initialization
│   ├── services/           # Core logic for translation, recognition, and avatar
│   └── main.py             # Main entry point for the API and WebSocket handlers
├── backend/                # Shared backend logic and algorithms
│   ├── dictionary/         # Logic for text-to-sign mapping
│   ├── nlp/                # Natural Language Processing for GSL translation
│   ├── sign_matching/      # DTW-based sign comparison algorithms
│   ├── sign_recognition/   # Machine learning inference logic
│   └── vision/             # Camera stream and pose estimation handling
├── data/                   # Data storage (ignored by git, except processed)
│   └── processed/          # Extracted images and sign index (included in repo)
├── data_pipeline/          # Scripts for processing raw data and training
├── ml/                     # Machine Learning datasets and prototypes
├── public/                 # Static assets for the frontend
├── scripts/                # Utility scripts for data extraction and build tasks
├── src/                    # React Frontend Source Code
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks (WebRTC, Theme, etc.)
│   ├── pages/              # Main application views (Home, Interpreter, etc.)
│   ├── stores/             # Zustand state management
│   └── App.tsx             # Main App component and routing
├── render.yaml             # Render deployment configuration
└── package.json            # Frontend dependencies and scripts
```

---

## 🚀 Key Features & Implementation

### 1. Interpreter Page
The core of the application. It supports two main modes:
- **Sign → Speech**: Uses the user's camera to detect hand and body landmarks via MediaPipe. These landmarks are sent via WebSockets to the backend, where they are compared against dictionary templates using **Dynamic Time Warping (DTW)**.
- **Speech → Sign**: Captures audio and uses **Whisper AI** (or Browser Speech API) to transcribe it. The recognized words are then matched against the GSL dictionary, displaying a sequence of instructional diagrams.

### 2. GSL Dictionary
A comprehensive resource for learning and reference.
- **Search**: Fast lookup of signs with fuzzy matching.
- **Alphabet Browse**: Browse signs by their starting letter.
- **Diagrams**: Every sign includes step-by-step diagrams extracted from the official GSL dictionary.

### 3. Smart Tips & Overlays
Provides real-time feedback during sign recognition, showing the predicted sign and confidence levels.

### 4. Accessibility Panel
Allows users to toggle:
- **High Contrast Mode**: For better visibility.
- **Large Text**: Increases font sizes across the app.
- **Landmark Visualization**: Shows the AI's skeletal tracking in real-time.

---

## 📦 Major Dependencies

### Frontend Packages
- `three`: Powers the 3D Signing Avatar (if enabled).
- `zustand`: Lightweight state management for global settings and session data.
- `lucide-react`: A beautiful, consistent icon set.
- `react-router-dom`: Handles SPA routing.

### Backend Packages
- `fastapi`: High-performance API framework.
- `google-genai`: Connects to Google's Gemini 2.0 Flash for the AI chatbot.
- `mediapipe`: Google's library for high-fidelity hand and pose tracking.
- `numpy` & `scipy`: Used for heavy mathematical calculations required for sign matching.
- `PyMuPDF` & `pdfplumber`: Used in scripts to extract data from the 250MB GSL PDF.

---

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### Steps
1. **Clone the repo**:
   ```bash
   git clone <repo-url>
   cd gsl
   ```
2. **Setup Frontend**:
   ```bash
   npm install
   ```
3. **Setup Backend**:
   ```bash
   pip install -r api/requirements.txt
   ```
4. **Environment Variables**:
   Create a `.env` file in the root:
   ```env
   GEMINI_API_KEY=your_key_here
   API_BASE_URL=http://localhost:8000
   ```
5. **Run the App**:
   ```bash
   # In one terminal
   npm run dev
   # In another terminal
   python -m uvicorn api.main:app --reload
   ```

---

## ☁️ Deployment on Render

This project is optimized for the **Render Free Tier**:
- **Static Assets**: Frontend is built and served by the FastAPI backend.
- **Memory Management**: Heavy ML models are removed or replaced with lightweight alternatives (like DTW matching) to fit within 512MB RAM.
- **Startup**: Services are initialized lazily to ensure the web service starts within the time limit.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
