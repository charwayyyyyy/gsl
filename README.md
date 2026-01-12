# Ghana Sign Language (GSL) Interpreter Platform

A production-grade, offline-first interpreter platform designed for the deaf community in Ghana. This system serves as a digital bridge, using the **"Ghanaian Sign Language Dictionary - 3rd Edition"** as its single source of truth to ensure cultural accuracy and authority.

## 🎯 Mission

To build a robust, accessible, and culturally respectful communication tool that:
1.  **Respects Authority**: Uses the official GSL dictionary as the gold standard.
2.  **Works Everywhere**: Fully functional offline, with no dependency on cloud APIs.
3.  **Requires No Training**: Uses rule-based matching and exact dictionary lookups instead of black-box ML that requires user data.
4.  **Is Accessible**: Designed with high contrast, clear visuals, and deaf-friendly UX patterns.

## ✨ Key Features

### 1. Text → Sign (Dictionary Search)
- **Authoritative Source**: Instantly retrieve signs from the GSL Dictionary 3rd Edition.
- **Visual Verification**: Displays the exact image from the physical dictionary pages.
- **Rich Context**: Includes English words, descriptions, and page numbers for reference.
- **Smart Search**: Fuzzy matching handles spelling variations while prioritizing exact matches.

### 2. Sign → Text (Interpreter)
- **Real-time Recognition**: Uses MediaPipe to track hand and body landmarks locally.
- **Rule-Based Matching**: Matches user gestures against the dictionary's defined sign properties (Handshape, Location, Movement).
- **Privacy-First**: Video is processed entirely on-device; no footage ever leaves the user's computer.

### 3. Dictionary Browser
- **A-Z Navigation**: Browse the entire vocabulary alphabetically.
- **Visual Grid**: Efficiently scan through hundreds of signs.
- **Lazy Loading**: Optimized performance for thousands of images.

### 4. Technical Resilience
- **Self-Healing**: Automatically rebuilds its database and image cache on startup if corruption is detected.
- **Deterministic**: ML fallbacks ensure the system always provides a "best guess" rather than failing silently.
- **Single-Command Start**: seamless orchestration of frontend and backend services.

## 🛠️ Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI, Uvicorn, SQLAlchemy
- **Computer Vision**: MediaPipe (Google), OpenCV
- **PDF Processing**: PyMuPDF (fitz) for real-time dictionary page rendering
- **Database**: SQLite (Zero-config, serverless)

## 🚀 Getting Started

### Prerequisites
- **OS**: Windows (optimized for), macOS, or Linux.
- **Python**: 3.10+
- **Node.js**: 18+
- **Package Manager**: `pnpm` (recommended) or `npm`.

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd gsl
    ```

2.  **Install dependencies**
    *   **Backend**:
        ```bash
        python -m venv .venv
        .\.venv\Scripts\Activate
        pip install -r requirements.txt
        ```
    *   **Frontend**:
        ```bash
        pnpm install
        # OR
        npm install
        ```

### 🏃‍♂️ Running the Application

We provide a single unified command to start the entire stack (Database checks, Backend API, and Frontend UI).

```bash
pnpm run start:all
# OR
npm run start:all
```

*   **Frontend**: http://localhost:5173
*   **Backend API**: http://0.0.0.0:8000
*   **API Docs**: http://0.0.0.0:8000/docs

## 📁 Project Structure

```
gsl/
├── api/                  # FastAPI Backend application
│   ├── main.py           # Entry point & startup logic
│   └── ...
├── backend/              # Core logic & Business rules
│   ├── dictionary/       # PDF parsing & Text-to-Sign logic
│   ├── sign_matching/    # Sign-to-Text rule engine
│   └── ...
├── src/                  # React Frontend application
│   ├── pages/            # Route components (Dictionary, Interpreter)
│   ├── components/       # Reusable UI components
│   └── ...
├── scripts/              # Automation & Utility scripts
│   ├── start_all.ps1     # Unified startup script
│   └── ...
└── data/                 # Local data storage
    ├── raw/              # "Ghanaian Sign Language Dictionary - 3rd Edition.pdf"
    └── processed/        # Extracted images and SQLite DB
```

## 🤝 Contribution

This project is built for the community. Contributions that improve accessibility, performance, or dictionary coverage are welcome.

## 📄 License

[License Information]
