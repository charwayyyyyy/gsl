import os
import json
import logging
import re
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
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_MODEL_FALLBACK = "gemini-pro"

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
    results = []
    
    q_lower = query.lower()
    words = set(q_lower.replace("?","").replace(".","").split())
    
    # Simple scoring: exact gloss match > word in gloss > word in desc
    scored_items = []
    for gloss, data in dictionary.items():
        score = 0
        gloss_lower = gloss.lower()
        desc_lower = data.get("description", "").lower()
        english_lower = data.get("english", "").lower()
        
        if q_lower == gloss_lower or q_lower == english_lower:
            score += 100
            
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
    return [item[1] for item in scored_items[:max_results]]

def is_sign_instruction_intent(message: str) -> bool:
    msg = (message or "").lower().strip()
    patterns = [
        r"\bhow\s+do\s+i\s+sign\b",
        r"\bhow\s+to\s+sign\b",
        r"\bshow\s+me\s+how\s+to\s+sign\b",
        r"\bwhat\s+is\s+the\s+sign\s+for\b",
    ]
    return any(re.search(p, msg) for p in patterns)

def is_sign_language_question(message: str) -> bool:
    msg = (message or "").lower().strip()
    patterns = [
        r"\bhow\s+do\s+i\s+sign\b",
        r"\bhow\s+to\s+sign\b",
        r"\bshow\s+me\s+signs?\b",
        r"\bwhat\s+is\s+the\s+sign\s+for\b",
        r"\bgsl\b",
        r"\bghana\s+sign\s+language\b",
        r"\bsign\s+language\b",
        r"\bdictionary\b",
        r"\btranslate\s+to\s+sign\b",
    ]
    return any(re.search(p, msg) for p in patterns)

def extract_instruction_target(message: str) -> str:
    msg = (message or "").strip()
    patterns = [
        r"(?i)how\s+do\s+i\s+sign\s+(.+?)\??$",
        r"(?i)how\s+to\s+sign\s+(.+?)\??$",
        r"(?i)show\s+me\s+how\s+to\s+sign\s+(.+?)\??$",
        r"(?i)what\s+is\s+the\s+sign\s+for\s+(.+?)\??$",
    ]

    stop_words = {
        "in", "on", "for", "please", "ghana", "gsl", "language", "sign"
    }

    for p in patterns:
        m = re.search(p, msg)
        if not m:
            continue

        phrase = re.sub(r"[^a-zA-Z0-9\s'-]", " ", m.group(1).strip())
        words = [w for w in phrase.split() if w.lower() not in stop_words]
        if words:
            return " ".join(words[:3]).strip()

    return ""

def build_instructional_answer(message: str, sources: list) -> str:
    top = sources[0]
    gloss = top.get("gloss", "this sign")
    english = top.get("english", "").strip()
    description = (top.get("description") or "").strip()

    def concise_description(gloss_text: str, raw: str) -> str:
        if not raw:
            return ""
        cleaned = " ".join(raw.split())
        upper_cleaned = cleaned.upper()
        upper_gloss = gloss_text.upper()
        idx = upper_cleaned.find(upper_gloss)
        if idx >= 0:
            segment = cleaned[idx + len(gloss_text):].strip(" :.-")
            if segment:
                return segment[:220].rstrip(" ,.;") + "."
        return cleaned[:220].rstrip(" ,.;") + "."

    heading = f"Here's a quick way to sign **{gloss}**"
    if english and english.lower() != gloss.lower():
        heading += f" ({english})"
    heading += ":"

    if description:
        quick_guide = concise_description(gloss, description)
    else:
        quick_guide = (
            "I found the sign in the dictionary, but the step-by-step description isn't available in this entry."
        )

    return (
        f"{heading}\n\n"
        f"{quick_guide}\n\n"
        "If you'd like, open the dictionary entry below to see the full page and diagrams."
    )

def handle_fallback(message, sources=None, reason=""):
    logger.warning(f"Using fallback response. Reason: {reason}")
    msg = str(message).lower()
    sources = sources or []
    
    if len(sources) > 0:
        ans = f"I found some information in the dictionary."
    else:
        ans = "I’m having trouble reaching the Gemini service right now."
        if "hello" in msg or "hi" in msg:
            ans = "Hello! How can I help you with Ghana Sign Language today?"
        elif "help" in msg:
            ans = "You can use Sign → Speech, Speech → Sign, or Text → Sign. I can help answer questions about the app or about GSL signs."
        elif "sign" in msg or "gsl" in msg:
            ans = "Ghana Sign Language is beautifully nuanced! If you need to translate, you can try our translation modes on the Home screen or look up a specific word here."
        else:
            ans = "I can answer Ghana Sign Language questions from the dictionary right now, but my general Gemini chat is offline until the API key is configured. Ask me about a sign, a word, or the app and I’ll help."
            
    return {
        "answer": ans,
        "sources": sources,
        "used_fallback": True
    }

@router.post("/chat")
async def chat(data: dict):
    user_message = data.get("message", "")
    
    # 1. Retrieve context only when the question is related to GSL or signs.
    # This keeps general questions free to be answered like a normal Gemini assistant.
    sources = []
    if is_sign_language_question(user_message):
        sources = search_dictionary(user_message)
        instruction_target = extract_instruction_target(user_message)
        if instruction_target:
            target_sources = search_dictionary(instruction_target)
            if target_sources:
                sources = target_sources

    # Deterministic explanation path for sign-instruction questions.
    # This guarantees we provide a useful explanation first, then guide to dictionary visuals.
    if sources and is_sign_instruction_intent(user_message):
        return {
            "answer": build_instructional_answer(user_message, sources),
            "sources": sources,
            "used_fallback": False
        }
    
    if not GEMINI_API_KEY:
        return handle_fallback(user_message, sources, "No API key configured.")

    # 2. Build prompt
    context_text = ""
    for idx, src in enumerate(sources):
        context_text += f"\n--- Entry {idx+1} ---\n"
        context_text += f"Gloss/Word: {src['gloss']}\n"
        context_text += f"Meaning: {src['english']}\n"
        context_text += f"Description: {src['description']}\n"
        context_text += f"Page: {src['page']}\n"
    
    system_instruction = (
        "You are SignBridge Assistant, a smart Gemini-style chat assistant for Ghana Sign Language and general conversation. "
        "Answer any normal question helpfully and naturally using your general knowledge. "
        "When the user asks about Ghana Sign Language, signs, translation, or the dictionary, use the retrieved dictionary context if it is available. "
        "If a matching sign exists, first give a brief practical explanation in plain language, then invite the user to open the dictionary entry for diagrams. "
        "If no dictionary entries match and the user clearly wants a sign, say so politely and suggest the dictionary. "
        "Do not claim certainty when the context is missing. "
        "Keep the tone friendly, clear, intelligent, and concise."
    )
    
    prompt = f"User Question: {user_message}\n\nRetrieved GSL Dictionary Context:\n{context_text if sources else 'No matching entries found.'}"

    try:
        if _gemini_client is None:
            return handle_fallback(user_message, sources, "No Gemini client configured.")

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=1024,
        )

        try:
            response = _gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
        except Exception as primary_error:
            logger.error(f"Gemini API error on {GEMINI_MODEL}: {primary_error}")
            response = _gemini_client.models.generate_content(
                model=GEMINI_MODEL_FALLBACK,
                contents=f"System: {system_instruction}\n\n{prompt}",
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    top_p=0.95,
                    max_output_tokens=1024,
                ),
            )

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
