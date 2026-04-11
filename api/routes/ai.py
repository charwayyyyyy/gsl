import os
import json
import logging
import re
import time
from fastapi import APIRouter
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)
router = APIRouter()

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DICTIONARY_PATH = Path("data") / "processed" / "gsl_dictionary.json"
GEMINI_MODELS = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
]

_dictionary_cache = None

def load_dictionary():
    global _dictionary_cache
    if _dictionary_cache is None:
        try:
            with open(DICTIONARY_PATH, "r", encoding="utf-8") as f:
                _dictionary_cache = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load dictionary for AI: {e}")
            _dictionary_cache = {}
    return _dictionary_cache

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

def search_dictionary(query: str, max_results=3):
    dictionary = load_dictionary()
    q_lower = (query or "").lower().strip()
    normalized_query = re.sub(r"[^a-z0-9\s'-]", " ", q_lower)
    words = [w for w in normalized_query.split() if w]

    # Rank exact gloss/meaning matches first, then partial phrase matches,
    # then fall back to broader description matching.
    scored_items = []
    for gloss, data in dictionary.items():
        score = 0
        gloss_lower = gloss.lower()
        desc_lower = data.get("description", "").lower()
        english_lower = data.get("english", "").lower()

        if q_lower == gloss_lower or q_lower == english_lower:
            score += 100

        if q_lower and (q_lower in gloss_lower or q_lower in english_lower):
            score += 45

        if words and any(w in gloss_lower for w in words):
            score += 20

        if words and any(w in english_lower for w in words):
            score += 20

        for w in words:
            if len(w) < 3 and w not in ["hi", "no", "ok", "go"]:
                continue
            if w == gloss_lower or w == english_lower:
                score += 50
            elif w in gloss_lower or w in english_lower:
                score += 20
            elif w in desc_lower:
                score += 5

        if score > 0:
            scored_items.append((score, {
                "gloss": gloss,
                "english": data.get("english", ""),
                "page": data.get("page", 0),
                "description": data.get("description", ""),
                "images": data.get("images", [])
            }))
            
    # Sort by score descending
    scored_items.sort(key=lambda x: x[0], reverse=True)

    # Return top items
    filtered = [item[1] for item in scored_items[:max_results]]

    # If we have an exact gloss match, keep just the exact match plus one related entry.
    exact_matches = [
        item[1] for item in scored_items
        if item[1]["gloss"].lower() == q_lower or item[1]["english"].lower() == q_lower
    ]
    if exact_matches:
        return exact_matches[:1] + [item[1] for item in scored_items if item[1] not in exact_matches][:1]

    return filtered

def build_dictionary_context(sources: list) -> str:
    if not sources:
        return "No matching entries found."

    blocks = []
    for idx, src in enumerate(sources[:2]):
        gloss = src.get("gloss", "")
        english = src.get("english", "")
        page = src.get("page", 0)
        description = " ".join((src.get("description") or "").split())

        # Keep the context short so Gemini gets the strongest signal without OCR noise.
        if len(description) > 260:
            description = description[:260].rstrip(" ,.;") + "..."

        blocks.append(
            f"--- Entry {idx + 1} ---\n"
            f"Gloss: {gloss}\n"
            f"English: {english}\n"
            f"Page: {page}\n"
            f"Description: {description}"
        )

    return "\n\n".join(blocks)

def is_sign_related_query(message: str) -> bool:
    text = (message or "").lower()
    patterns = [
        r"\bhow\s+do\s+i\s+sign\b",
        r"\bhow\s+to\s+sign\b",
        r"\bsign\s+language\b",
        r"\bgsl\b",
        r"\bdictionary\b",
        r"\btranslate\b",
        r"\bgesture\b",
    ]
    return any(re.search(p, text) for p in patterns)

def extract_sign_target(message: str) -> str:
    text = (message or "").strip()
    patterns = [
        r"(?i)how\s+do\s+i\s+sign\s+(.+?)\??$",
        r"(?i)how\s+to\s+sign\s+(.+?)\??$",
        r"(?i)what\s+is\s+the\s+sign\s+for\s+(.+?)\??$",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            target = re.sub(r"[^a-zA-Z0-9\s'-]", " ", m.group(1)).strip()
            return " ".join(target.split())
    return ""

def handle_fallback(message, sources=None, reason=""):
    logger.warning(f"Using fallback response. Reason: {reason}")
    return {
        "answer": "I’m having trouble reaching the AI service right now. Please try again in a moment.",
        "sources": sources or [],
        "used_fallback": True
    }

@router.post("/chat")
async def chat(data: dict):
    user_message = data.get("message", "")
    sources = []
    if is_sign_related_query(user_message):
        target = extract_sign_target(user_message)
        if target:
            sources = search_dictionary(target)
        if not sources:
            sources = search_dictionary(user_message)
    
    if not GEMINI_API_KEY:
        return handle_fallback(user_message, sources, "No API key configured.")

    # 2. Build prompt
    context_text = build_dictionary_context(sources)
    
    system_instruction = (
        "You are SignBridge Assistant, a smart Gemini-style chat assistant for Ghana Sign Language and general conversation. "
        "Answer any normal question helpfully and naturally using your general knowledge. "
        "When the user asks about Ghana Sign Language, signs, translation, or the dictionary, use the retrieved dictionary context if it is available. "
        "If a matching sign exists, first give a brief practical explanation in plain language, then invite the user to open the dictionary entry for diagrams. "
        "If no dictionary entries match and the user clearly wants a sign, say so politely and suggest the dictionary. "
        "Do not claim certainty when the context is missing. "
        "Keep the tone friendly, clear, intelligent, and concise."
    )
    
    prompt = (
        f"User Question: {user_message}\n\n"
        f"Retrieved GSL Dictionary Context:\n{context_text if sources else 'No matching entries found.'}\n\n"
        "If the question is about Ghana Sign Language, use the dictionary context to answer. "
        "If it is a general question, answer normally and naturally. "
        "If a relevant dictionary entry exists, you may mention it briefly and invite the user to open the dictionary for diagrams. "
        "Do not fabricate sign information."
    )

    try:
        gemini_client = get_gemini_client()
        if gemini_client is None:
            return handle_fallback(user_message, sources, "No Gemini client configured.")

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=1024,
        )

        response = None
        last_error = None
        for model_name in GEMINI_MODELS:
            max_attempts = 2 if model_name == "models/gemini-2.5-flash" else 1
            for attempt in range(max_attempts):
                try:
                    response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=config,
                    )
                    break
                except Exception as model_error:
                    last_error = model_error
                    logger.error(f"Gemini API error on {model_name} (attempt {attempt + 1}/{max_attempts}): {model_error}")
                    # Retry once for transient high-demand errors on the primary model.
                    if attempt < max_attempts - 1 and "503" in str(model_error):
                        time.sleep(0.8)
                        continue
                    break
            if response is not None:
                break

        if response is None:
            return handle_fallback(user_message, sources, f"Gemini request failed: {last_error}")

        text = getattr(response, "text", None)
        if not text and getattr(response, "candidates", None):
            try:
                text = response.candidates[0].content.parts[0].text
            except Exception:
                text = None

        if text:
            return {
                "answer": text,
                "sources": sources,
                "used_fallback": False
            }

        logger.error(f"Failed to parse Gemini response: {response}")
        return handle_fallback(user_message, sources, "Parsing error.")

    except Exception as e:
        logger.error(f"Gemini assistant failed: {str(e)}")
        return handle_fallback(user_message, sources, "Service unavailable.")
