## 1. Architecture Design

```mermaid
graph TD
  A[User Browser] --> B[React Frontend]
  B --> C[WebRTC Media Capture]
  C --> D[FastAPI Backend]
  
  D --> E[Video Processing Service]
  D --> F[Speech Recognition Service]
  D --> G[Translation Engine]
  D --> H[Sign Rendering Engine]
  
  E --> I[MediaPipe Tasks]
  E --> J[PyTorch Sign Recognition]
  
  F --> K[Whisper Streaming]
  
  G --> L[GSL Dictionary Dataset]
  G --> M[Transformer Models]
  
  H --> N[3D Avatar System]
  H --> O[Video Clip Sequencer]
  
  subgraph "Frontend Layer"
    B
    C
  end
  
  subgraph "Backend Services"
    D
    E
    F
    G
    H
  end
  
  subgraph "AI/ML Models"
    I
    J
    K
    M
  end
  
  subgraph "Data Layer"
    L
  end
  
  subgraph "Rendering Systems"
    N
    O
  end
```

## 2. Technology Description

- **Frontend**: React@18 + Vite + Tailwind CSS + WebRTC
- **Backend**: FastAPI + WebSockets + AsyncIO
- **AI/ML**: PyTorch@2.1 + MediaPipe@0.10 + Whisper@20231117 + Sentence Transformers
- **3D Rendering**: Three.js + @react-three/fiber + @react-three/drei
- **Data Storage**: SQLite + JSON + Local Storage
- **Initialization Tool**: vite-init

## 3. Route Definitions

| Route | Purpose |
|-------|---------|
| / | Home page with mode selection |
| /interpreter | Main translation interface |
| /settings | User preferences and accessibility |
| /help | Visual tutorials and troubleshooting |
| /api/video/stream | WebSocket endpoint for video processing |
| /api/audio/stream | WebSocket endpoint for audio processing |
| /api/translate/sign-to-speech | GSL to English translation |
| /api/translate/speech-to-sign | English to GSL translation |
| /api/avatar/render | 3D avatar animation data |
| /api/dictionary | GSL dictionary data access |

## 4. API Definitions

### 4.1 Video Processing API
```
WebSocket /api/video/stream
```

Incoming Message:
```json
{
  "type": "video_frame",
  "data": "base64_encoded_frame",
  "timestamp": 1234567890,
  "resolution": {"width": 640, "height": 480}
}
```

Outgoing Message:
```json
{
  "type": "pose_data",
  "landmarks": {
    "hands": [[x, y, z], ...],
    "pose": [[x, y, z], ...],
    "face": [[x, y, z], ...]
  },
  "confidence": 0.95,
  "timestamp": 1234567890
}
```

### 4.2 Translation API
```
POST /api/translate/sign-to-speech
```

Request:
```json
{
  "pose_sequence": [
    {"landmarks": {...}, "timestamp": 1234567890},
    {"landmarks": {...}, "timestamp": 1234567891}
  ],
  "context": "previous_glosses"
}
```

Response:
```json
{
  "gsl_glosses": ["HELLO", "HOW", "YOU"],
  "english_text": "Hello, how are you?",
  "confidence": 0.89,
  "processing_time_ms": 245
}
```

### 4.3 Avatar Rendering API
```
POST /api/avatar/render
```

Request:
```json
{
  "gsl_sequence": ["HELLO", "NAME", "WHAT"],
  "animation_mode": "3d_avatar",
  "speed": 1.0,
  "facial_expressions": true
}
```

Response:
```json
{
  "animation_data": {
    "keyframes": [...],
    "duration_ms": 2500,
    "blend_shapes": {...}
  },
  "video_clips": ["clip1.mp4", "clip2.mp4"],
  "transition_data": {...}
}
```

## 5. Server Architecture Diagram

```mermaid
graph TD
  A[Client Request] --> B[API Gateway]
  B --> C[Video Controller]
  B --> D[Audio Controller]
  B --> E[Translation Controller]
  B --> F[Avatar Controller]
  
  C --> G[Video Processing Service]
  D --> H[Speech Recognition Service]
  E --> I[Translation Service]
  F --> J[Avatar Rendering Service]
  
  G --> K[MediaPipe Integration]
  H --> L[Whisper Integration]
  I --> M[GSL Dictionary Service]
  J --> N[3D Rendering Engine]
  
  K --> O[(SQLite Cache)]
  L --> O
  M --> P[(GSL Dictionary DB)]
  N --> Q[(Animation Assets)]
  
  subgraph "Controller Layer"
    C
    D
    E
    F
  end
  
  subgraph "Service Layer"
    G
    H
    I
    J
  end
  
  subgraph "Integration Layer"
    K
    L
    M
    N
  end
  
  subgraph "Data Layer"
    O
    P
    Q
  end
```

## 6. Data Model

### 6.1 Data Model Definition
```mermaid
erDiagram
  GSL_SIGN ||--o{ SIGN_VARIANT : contains
  GSL_SIGN ||--o{ FACIAL_EXPRESSION : has
  GSL_SIGN ||--o{ USAGE_EXAMPLE : includes
  SIGN_SEQUENCE ||--o{ SEQUENCE_SIGN : contains
  TRANSLATION_SESSION ||--o{ TRANSLATION_EVENT : contains
  
  GSL_SIGN {
    string id PK
    string gloss UK
    string english_meaning
    string category
    string complexity_level
    string handshape
    string location
    string movement
    string orientation
    boolean both_hands
    string image_path
    string video_path
  }
  
  SIGN_VARIANT {
    string id PK
    string sign_id FK
    string variant_type
    string context_notes
    string image_path
  }
  
  FACIAL_EXPRESSION {
    string id PK
    string sign_id FK
    string expression_type
    string intensity
    string timing
  }
  
  USAGE_EXAMPLE {
    string id PK
    string sign_id FK
    string example_sentence
    string context
  }
  
  SIGN_SEQUENCE {
    string id PK
    string session_id FK
    timestamp created_at
    string sequence_type
    float confidence_score
  }
  
  SEQUENCE_SIGN {
    string id PK
    string sequence_id FK
    string sign_id FK
    integer position
    float timing_offset
  }
  
  TRANSLATION_SESSION {
    string id PK
    string direction
    timestamp start_time
    timestamp end_time
    string device_info
    float avg_confidence
  }
  
  TRANSLATION_EVENT {
    string id PK
    string session_id FK
    timestamp event_time
    string input_type
    string input_data
    string output_data
    float confidence
    integer processing_time_ms
  }
```

### 6.2 Data Definition Language

**GSL Signs Table**
```sql
CREATE TABLE gsl_signs (
  id VARCHAR(50) PRIMARY KEY,
  gloss VARCHAR(100) NOT NULL UNIQUE,
  english_meaning TEXT NOT NULL,
  category VARCHAR(50),
  complexity_level VARCHAR(20) CHECK (complexity_level IN ('basic', 'intermediate', 'advanced')),
  handshape VARCHAR(100),
  location VARCHAR(100),
  movement VARCHAR(200),
  orientation VARCHAR(50),
  both_hands BOOLEAN DEFAULT FALSE,
  image_path VARCHAR(500),
  video_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gsl_signs_gloss ON gsl_signs(gloss);
CREATE INDEX idx_gsl_signs_category ON gsl_signs(category);
CREATE INDEX idx_gsl_signs_complexity ON gsl_signs(complexity_level);
```

**Translation Sessions Table**
```sql
CREATE TABLE translation_sessions (
  id VARCHAR(50) PRIMARY KEY,
  direction VARCHAR(20) CHECK (direction IN ('sign_to_speech', 'speech_to_sign')),
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  device_info JSON,
  avg_confidence FLOAT,
  total_events INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_direction ON translation_sessions(direction);
CREATE INDEX idx_sessions_start_time ON translation_sessions(start_time);
```

**Translation Events Table**
```sql
CREATE TABLE translation_events (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50) REFERENCES translation_sessions(id),
  event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  input_type VARCHAR(50),
  input_data JSON,
  output_data JSON,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_session_id ON translation_events(session_id);
CREATE INDEX idx_events_event_time ON translation_events(event_time);
```

**Sign Sequences Table**
```sql
CREATE TABLE sign_sequences (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(50) REFERENCES translation_sessions(id),
  sequence_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confidence_score FLOAT,
  timing_data JSON
);

CREATE INDEX idx_sequences_session_id ON sign_sequences(session_id);
```