# Ghana Sign Language (GSL) Interpreter System

A comprehensive, real-time, bidirectional Sign Language ↔ Speech Interpreter specifically designed for Ghana Sign Language (GSL). This system provides accessibility-first communication tools for deaf, hard-of-hearing, and non-verbal users in Ghana.

## 🎯 Project Overview

This system translates between Ghana Sign Language and spoken English in real-time, with <500ms latency, using advanced AI and computer vision technologies. Built with accessibility, accuracy, and cultural sensitivity as core principles.

### Key Features

- **Real-time Translation**: Bidirectional GSL ↔ English translation with sub-500ms latency
- **Accessibility-First Design**: Large text, high contrast, dyslexia-friendly fonts, visual indicators
- **Ghana-Specific Localization**: Built specifically for Ghanaian users with local cultural context
- **Advanced AI Models**: PyTorch transformers for sign recognition, OpenAI Whisper for speech
- **3D Avatar Rendering**: Three.js-based sign language visualization
- **Comprehensive Testing**: Full test suite ensuring reliability and performance

## 🏗️ System Architecture

### Frontend (React + TypeScript + Vite)
- **Components**: VideoCapture, AudioCapture, AvatarRenderer, DirectionSelection
- **Pages**: Home, Interpreter, Settings, Help/Tutorial
- **State Management**: Zustand for accessibility and translation settings
- **Styling**: Tailwind CSS with accessibility-first design
- **3D Rendering**: Three.js for avatar visualization

### Backend (FastAPI + Python)
- **WebSocket Streaming**: Real-time video/audio processing
- **AI Services**: Sign recognition, speech recognition, translation
- **Database**: SQLAlchemy with comprehensive GSL dictionary
- **MediaPipe Integration**: Pose detection, hand tracking, face mesh analysis

### AI/ML Components
- **Sign Recognition**: PyTorch transformer models with MediaPipe feature extraction
- **Speech Recognition**: OpenAI Whisper with Voice Activity Detection
- **Translation Engine**: GSL-specific grammar rules and neural translation
- **3D Avatar**: Real-time sign language animation

## 📋 Prerequisites

### System Requirements
- Python 3.11 (recommended)
- Node.js LTS (v18 or v20)
- Webcam and microphone
- 8GB+ RAM

### Notes
- Python 3.13 may try to build native wheels (Rust toolchain), causing install failures. Use Python 3.11.
- If `npm install` throws errors, use `npx pnpm@8.15.8 install` to install frontend dependencies.

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/gsl-interpreter.git
cd gsl-interpreter
```

### 2. Install Python Dependencies
```bash
cd api
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies
```bash
cd ../src
npm install
```

### 4. Download AI Models
```bash
# Download Whisper model
python -c "import whisper; whisper.load_model('base')"

# Download MediaPipe models (automatic)
```

### 5. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

## 🏃‍♂️ Running the Application

### Quickstart (Windows)
```bash
# Create and activate venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend deps
pip install -r requirements.txt
pip install -r api/requirements.txt

# Initialize SQLite database
python scripts/init_sqlite.py

# Start backend (FastAPI)
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# In another terminal: install and start frontend
npx pnpm@8.15.8 install
npx pnpm@8.15.8 run dev
# Open http://localhost:5173
```

### Helper Scripts
```bash
# Backend
powershell -File scripts/start_backend.ps1

# Frontend
powershell -File scripts/start_frontend.ps1
```

### Production Mode
```bash
# Build frontend
npx pnpm@8.15.8 run build

# Start backend
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

## 📖 Usage Guide

### For First-Time Users

1. **Choose Translation Direction**: Select "Sign to Speech" or "Speech to Sign"
2. **Allow Permissions**: Grant camera and microphone access
3. **Start Communicating**: Begin signing or speaking - the system will translate automatically

### Accessibility Features

- **Large Text Mode**: Increases text size for better readability
- **High Contrast Mode**: Enhances color contrast for better visibility
- **Dyslexia-Friendly Font**: Uses fonts designed for dyslexic users
- **Visual Indicators**: Provides visual feedback for system status
- **Audio Feedback**: Optional audio cues for system events

### Settings Customization

- **Translation Speed**: Adjust processing speed vs. accuracy
- **Audio Settings**: Configure microphone sensitivity and output volume
- **Visual Settings**: Customize display preferences and visual feedback
- **Ghana-Specific Settings**: Adjust for Ghanaian languages and dialects

## 🧪 Testing

### Run All Tests
```bash
# Backend tests
cd api
pytest tests/test_all_components.py -v

# Frontend tests
cd src
npm test
```

### Test Coverage
- **Dictionary Service**: PDF extraction, sign parsing, categorization
- **MediaPipe Service**: Landmark extraction, feature processing
- **Sign Recognition**: Model inference, sequence processing
- **Speech Recognition**: Audio processing, transcription accuracy
- **Translation Engine**: Grammar rules, bidirectional translation
- **Integration Tests**: Complete pipeline testing

## 🔧 Configuration

## 📦 Data Pipeline

- Place the full dictionary at `Ghanaian Sign Language Dictionary - 3rd Edition.pdf` (ignored by git)
- Chunk the PDF into 50–100 page parts:

```bash
python -m data_pipeline.chunk_pdf "Ghanaian Sign Language Dictionary - 3rd Edition.pdf"
```

- Parse and build JSON chunks:

```bash
python -m data_pipeline.parse_dictionary "Ghanaian Sign Language Dictionary - 3rd Edition.pdf" --chunk 500
```

- Build embeddings (local-first):

```bash
python -m data_pipeline.build_embeddings
```

- Train temporal sign model (synthetic alignment placeholder):

```bash
python -m data_pipeline.train_sign_transformer
```

Data outputs:
- `data/chunks_pdf/` (ignored)
- `data/gsl_json/` (version-controlled JSON chunks)
- `data/embeddings/` (ignored)
- `data/images/` (ignored)

### Environment Variables
```env
# Database
DATABASE_URL=sqlite:///./gsl_interpreter.db

# Frontend
VITE_API_URL=http://localhost:8000
```

### Model Configuration

#### Sign Recognition
- Input: MediaPipe landmarks (258 dimensions)
- Model: Transformer encoder with attention pooling
- Output: GSL sign classification (1000+ classes)
- Latency: <300ms

#### Speech Recognition
- Model: OpenAI Whisper (base/large variants)
- Languages: English + Ghanaian languages
- Real-time: 2-second chunks with 0.5s overlap
- VAD: Energy-based voice activity detection

#### Translation Engine
- GSL Grammar Rules: Topic-Comment structure, temporal markers
- Bidirectional: GSL ↔ English with context awareness
- Confidence scoring and fallback mechanisms

## 📊 Performance Metrics

### Latency Requirements
- **Sign Recognition**: <300ms
- **Speech Recognition**: <200ms
- **Translation**: <100ms
- **Total Pipeline**: <500ms

### Accuracy Targets
- **Sign Recognition**: >85% accuracy
- **Speech Recognition**: >90% word accuracy
- **Translation**: >80% semantic accuracy

### System Requirements
- **Memory Usage**: <4GB RAM
- **GPU Memory**: <2GB VRAM
- **CPU Usage**: <50% on modern processors
- **Network**: Stable broadband for real-time features

## 🔒 Security & Privacy

### Data Protection
- All audio/video processing is local (no cloud upload)
- User data is encrypted at rest
- No persistent storage of biometric data
- GDPR-compliant data handling

### Access Control
- Role-based access for different user types
- Session-based authentication
- Secure WebSocket connections
- Rate limiting for API endpoints

## 🌍 Ghana-Specific Features

### Cultural Adaptations
- **Local Dialects**: Support for Ghanaian English variations
- **Cultural Context**: Sign meanings adapted for Ghanaian culture
- **Regional Variations**: Different sign variants across Ghana regions
- **Educational Integration**: Curriculum-aligned for Ghanaian schools

### Language Support
- **Primary**: Ghana Sign Language (GSL)
- **Secondary**: English, Twi, Fante, Ewe, Ga
- **Future**: Hausa, Dagbani, other Ghanaian languages

## 🛠️ Development

### Project Structure
```
gsl/
├── api/                    # FastAPI backend
│   ├── main.py             # App entry
│   ├── services/           # Services (translation, mediapipe, etc.)
│   ├── database/           # SQLAlchemy models & session
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Home, Interpreter, Settings, Help
│   ├── hooks/              # WebRTC + WebSocket hooks
│   ├── stores/             # Zustand app store
├── scripts/                # Start scripts & DB init
├── data_pipeline/          # Offline data processing
```

## 🔌 API & UI Integration

### Backend Endpoints
- `GET /health` — health check
- `WS /api/video/stream` — client sends base64 video frames; server returns `pose_data`
- `WS /api/audio/stream` — client sends audio chunks; server returns `transcription`
- `POST /api/translate/sign-to-speech`
- `POST /api/translate/speech-to-sign`
- `GET /api/dictionary/search?query=`
- `GET /api/dictionary/sign/{id}`

### Frontend Routes
- `/` — Direction selection (start session)
- `/interpreter` — Live translator UI
- `/settings` — Accessibility and preferences
- `/help` — Tutorial and troubleshooting

### CORS
- Allowed origins: `http://localhost:5173`

## 🔎 Troubleshooting

- "Service is unavailable" on the UI
  - Ensure the frontend dev server is running at `http://localhost:5173`
  - Restart the dev server: `npx pnpm@8.15.8 run dev`

- `npm install` errors
  - Use `npx pnpm@8.15.8 install`

- Python 3.13 package build failures
  - Install Python 3.11, recreate venv, reinstall requirements

- MediaPipe/Torch missing
  - Backend runs with graceful fallbacks (rule-based translation, optional mediapipe). Install libs later if needed.

## 🔗 Repository

GitHub: https://github.com/charwayyyyyy/gsl

### Development Workflow
1. **Feature Development**: Create feature branch from main
2. **Testing**: Write comprehensive tests for new features
3. **Code Review**: Submit PR with detailed description
4. **Integration Testing**: Run full test suite
5. **Documentation**: Update docs for new features
6. **Deployment**: Merge to main after approval

### Contributing Guidelines
- Follow accessibility-first design principles
- Maintain <500ms latency requirements
- Test with real Ghanaian users when possible
- Document all API changes
- Include comprehensive error handling

## 📚 Documentation

### API Documentation
- **Swagger UI**: Available at `http://localhost:8000/docs`
- **ReDoc**: Available at `http://localhost:8000/redoc`
- **WebSocket Docs**: Real-time communication protocols

### User Guides
- **Quick Start**: Getting started in 5 minutes
- **Accessibility Guide**: Comprehensive accessibility features
- **Troubleshooting**: Common issues and solutions
- **Advanced Usage**: Power user features and customization

### Technical Documentation
- **Architecture Overview**: System design and components
- **AI Model Documentation**: Training, evaluation, deployment
- **Database Schema**: Entity relationships and data flow
- **Deployment Guide**: Production setup and scaling

## 🤝 Support & Community

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive guides and tutorials
- **Community Forum**: User discussions and support
- **Email Support**: Direct contact for critical issues

### Contributing
- **Code Contributions**: Follow development guidelines
- **Documentation**: Help improve user guides
- **Testing**: Contribute to test coverage
- **Localization**: Translate to other languages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ghana National Association of the Deaf (GNAD)**: For cultural guidance and sign language expertise
- **University of Ghana**: Linguistic research and validation
- **Open Source Community**: Contributing libraries and frameworks
- **Accessibility Advocates**: For user-centered design principles

## 📞 Contact

- **Project Maintainer**: [Your Name](mailto:your.email@example.com)
- **Organization**: [Your Organization]
- **Support Email**: support@gsl-interpreter.org
- **Website**: https://gsl-interpreter.org

---

**Made with ❤️ for the Ghanaian deaf and hard-of-hearing community**
