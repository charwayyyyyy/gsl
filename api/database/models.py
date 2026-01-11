from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from .database import Base
import uuid

# Association table for many-to-many relationship between signs and sequences
sign_sequence_association = Table(
    'sign_sequence_signs',
    Base.metadata,
    Column('sequence_id', String, ForeignKey('sign_sequences.id'), primary_key=True),
    Column('sign_id', String, ForeignKey('gsl_signs.id'), primary_key=True),
    Column('position', Integer),
    Column('timing_offset', Float)
)

class GSLSign(Base):
    __tablename__ = "gsl_signs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    gloss = Column(String(100), nullable=False, unique=True, index=True)
    english_meaning = Column(Text, nullable=False)
    category = Column(String(50), index=True)
    complexity_level = Column(String(20))  # basic, intermediate, advanced
    handshape = Column(String(100))
    location = Column(String(100))
    movement = Column(String(200))
    orientation = Column(String(50))
    both_hands = Column(Boolean, default=False)
    image_path = Column(String(500))
    video_path = Column(String(500))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    variants = relationship("SignVariant", back_populates="sign", cascade="all, delete-orphan")
    facial_expressions = relationship("FacialExpression", back_populates="sign", cascade="all, delete-orphan")
    usage_examples = relationship("UsageExample", back_populates="sign", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "gloss": self.gloss,
            "english_meaning": self.english_meaning,
            "category": self.category,
            "complexity_level": self.complexity_level,
            "handshape": self.handshape,
            "location": self.location,
            "movement": self.movement,
            "orientation": self.orientation,
            "both_hands": self.both_hands,
            "image_path": self.image_path,
            "video_path": self.video_path,
            "variants": [variant.to_dict() for variant in self.variants],
            "facial_expressions": [expr.to_dict() for expr in self.facial_expressions],
            "usage_examples": [example.to_dict() for example in self.usage_examples]
        }

class SignVariant(Base):
    __tablename__ = "sign_variants"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sign_id = Column(String, ForeignKey("gsl_signs.id"), nullable=False)
    variant_type = Column(String(50))  # regional, contextual, temporal, etc.
    context_notes = Column(Text)
    image_path = Column(String(500))
    
    # Relationships
    sign = relationship("GSLSign", back_populates="variants")
    
    def to_dict(self):
        return {
            "id": self.id,
            "variant_type": self.variant_type,
            "context_notes": self.context_notes,
            "image_path": self.image_path
        }

class FacialExpression(Base):
    __tablename__ = "facial_expressions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sign_id = Column(String, ForeignKey("gsl_signs.id"), nullable=False)
    expression_type = Column(String(50))  # eyebrow_raise, eye_squint, mouth_shape, etc.
    intensity = Column(String(20))  # low, medium, high
    timing = Column(String(50))  # onset, peak, offset timing information
    
    # Relationships
    sign = relationship("GSLSign", back_populates="facial_expressions")
    
    def to_dict(self):
        return {
            "id": self.id,
            "expression_type": self.expression_type,
            "intensity": self.intensity,
            "timing": self.timing
        }

class UsageExample(Base):
    __tablename__ = "usage_examples"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sign_id = Column(String, ForeignKey("gsl_signs.id"), nullable=False)
    example_sentence = Column(Text, nullable=False)
    context = Column(String(100))  # formal, informal, educational, etc.
    
    # Relationships
    sign = relationship("GSLSign", back_populates="usage_examples")
    
    def to_dict(self):
        return {
            "id": self.id,
            "example_sentence": self.example_sentence,
            "context": self.context
        }

class TranslationSession(Base):
    __tablename__ = "translation_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    direction = Column(String(20), nullable=False)  # sign_to_speech, speech_to_sign
    start_time = Column(DateTime, default=func.now())
    end_time = Column(DateTime, nullable=True)
    device_info = Column(JSON)
    avg_confidence = Column(Float)
    total_events = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    events = relationship("TranslationEvent", back_populates="session", cascade="all, delete-orphan")
    sign_sequences = relationship("SignSequence", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "direction": self.direction,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "device_info": self.device_info,
            "avg_confidence": self.avg_confidence,
            "total_events": self.total_events,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class TranslationEvent(Base):
    __tablename__ = "translation_events"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("translation_sessions.id"), nullable=False, index=True)
    event_time = Column(DateTime, default=func.now())
    input_type = Column(String(50))  # video_frame, audio_chunk, sign_sequence, speech_text
    input_data = Column(JSON)
    output_data = Column(JSON)
    confidence = Column(Float)  # 0.0 to 1.0
    processing_time_ms = Column(Integer)
    error_message = Column(Text)
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    session = relationship("TranslationSession", back_populates="events")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "event_time": self.event_time.isoformat() if self.event_time else None,
            "input_type": self.input_type,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "confidence": self.confidence,
            "processing_time_ms": self.processing_time_ms,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class SignSequence(Base):
    __tablename__ = "sign_sequences"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("translation_sessions.id"), nullable=False, index=True)
    sequence_type = Column(String(50))  # continuous, isolated, fingerspelling
    confidence_score = Column(Float)
    timing_data = Column(JSON)  # timing information for each sign in sequence
    created_at = Column(DateTime, default=func.now())
    
    # Relationships
    session = relationship("TranslationSession", back_populates="sign_sequences")
    signs = relationship("GSLSign", secondary=sign_sequence_association, backref="sequences")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "sequence_type": self.sequence_type,
            "confidence_score": self.confidence_score,
            "timing_data": self.timing_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "signs": [sign.to_dict() for sign in self.signs]
        }

class UserSettings(Base):
    __tablename__ = "user_settings"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, unique=True, nullable=False)
    
    # Accessibility settings
    high_contrast = Column(Boolean, default=False)
    large_text = Column(Boolean, default=False)
    dyslexia_friendly_font = Column(Boolean, default=False)
    
    # Translation preferences
    sign_speed = Column(Float, default=1.0)  # 0.5x to 2.0x
    speech_speed = Column(Float, default=1.0)
    avatar_mode = Column(String(20), default="3d_avatar")  # 3d_avatar, video_clips
    
    # Audio settings
    volume_level = Column(Float, default=0.8)  # 0.0 to 1.0
    audio_feedback = Column(Boolean, default=True)
    
    # Visual settings
    show_confidence = Column(Boolean, default=True)
    show_landmarks = Column(Boolean, default=True)
    animation_quality = Column(String(20), default="high")  # low, medium, high
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "accessibility": {
                "high_contrast": self.high_contrast,
                "large_text": self.large_text,
                "dyslexia_friendly_font": self.dyslexia_friendly_font
            },
            "translation": {
                "sign_speed": self.sign_speed,
                "speech_speed": self.speech_speed,
                "avatar_mode": self.avatar_mode
            },
            "audio": {
                "volume_level": self.volume_level,
                "audio_feedback": self.audio_feedback
            },
            "visual": {
                "show_confidence": self.show_confidence,
                "show_landmarks": self.show_landmarks,
                "animation_quality": self.animation_quality
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
