import os
import json
import logging
import re
import time
from datetime import datetime
from fastapi import APIRouter
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from typing import Optional

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

def is_dictionary_count_question(message: str) -> bool:
    text = (message or "").lower()
    patterns = [
        r"\bhow\s+many\s+signs?\b",
        r"\bhow\s+many\s+entries?\b",
        r"\bnumber\s+of\s+signs?\b",
        r"\bcount\s+of\s+signs?\b",
        r"\bhow\s+many\s+signs\s+is\s+in\s+the\s+dictionary\b",
        r"\bhow\s+many\s+signs\s+are\s+in\s+the\s+dictionary\b",
    ]
    return any(re.search(p, text) for p in patterns)

def build_dictionary_count_answer() -> str:
    total = len(load_dictionary())
    return (
        f"The current GSL dictionary has {total} usable signs in the processed dataset. "
        "If you want, I can also help you search a specific sign or open the dictionary."
    )

def safe_eval_math(expression: str):
    import ast
    import operator as op

    allowed_ops = {
        ast.Add: op.add,
        ast.Sub: op.sub,
        ast.Mult: op.mul,
        ast.Div: op.truediv,
        ast.FloorDiv: op.floordiv,
        ast.Mod: op.mod,
        ast.Pow: op.pow,
        ast.USub: op.neg,
        ast.UAdd: op.pos,
    }

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_ops:
            return allowed_ops[type(node.op)](_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed_ops:
            return allowed_ops[type(node.op)](_eval(node.operand))
        raise ValueError("Unsupported expression")

    tree = ast.parse(expression, mode="eval")
    return _eval(tree)

def build_local_general_answer(message: str) -> Optional[str]:
    text = (message or "").strip().lower()
    compact = re.sub(r"\s+", " ", text)

    if not compact:
        return None

    if any(phrase in compact for phrase in ["what can you help me with", "what can you do", "help me", "how can you help"]):
        return (
            "I can answer general questions, explain Ghana Sign Language signs, count dictionary entries, "
            "and help you open the right dictionary page when a sign is available."
        )

    if any(phrase in compact for phrase in ["who are you", "what are you", "your name"]):
        return "I’m the SignBridge Assistant. I help with Ghana Sign Language and general questions."

    if any(phrase in compact for phrase in ["capital of france", "what is the capital of france"]):
        return "The capital of France is Paris."

    if any(phrase in compact for phrase in ["capital of ghana", "what is the capital of ghana"]):
        return "The capital of Ghana is Accra."

    if any(phrase in compact for phrase in ["capital of", "what is the capital"]):
        country_matches = {
            "france": "Paris",
            "ghana": "Accra",
            "nigeria": "Abuja",
            "kenya": "Nairobi",
            "south africa": "Pretoria",
            "canada": "Ottawa",
            "united states": "Washington, D.C.",
            "usa": "Washington, D.C.",
            "uk": "London",
            "united kingdom": "London",
        }
        for country, capital in country_matches.items():
            if country in compact:
                return f"The capital of {country.title()} is {capital}."

    math_match = re.search(r"(?<!\w)(?:what is |calculate )?([0-9\s\+\-\*\/\%\(\)\.\^]+)(?:\?|$)", text)
    if math_match:
        expression = math_match.group(1).replace("^", "**").strip()
        if re.fullmatch(r"[0-9\s\+\-\*\/\%\(\)\.\*]+", expression):
            try:
                result = safe_eval_math(expression)
                if isinstance(result, float) and result.is_integer():
                    result = int(result)
                return f"The answer is {result}."
            except Exception:
                pass

    if any(phrase in compact for phrase in ["what time is it", "current time", "what day is it", "current date"]):
        now = datetime.now()
        return f"It’s {now.strftime('%I:%M %p on %A, %d %B %Y').lstrip('0')}."

    if compact in {"hello", "hi", "hey"}:
        return "Hello! How can I help you today?"

    if compact in {"yes", "yeah", "yep", "sure", "ok", "okay", "alright"}:
        return "Great. What would you like to ask next?"

    if "thank you" in compact or compact == "thanks":
        return "You’re welcome."

    return None

def concise_sign_description(gloss_text: str, raw_description: str) -> str:
    if not raw_description:
        return ""

    cleaned = " ".join(raw_description.split())
    upper_cleaned = cleaned.upper()
    upper_gloss = gloss_text.upper()
    idx = upper_cleaned.find(upper_gloss)
    if idx >= 0:
        segment = cleaned[idx + len(gloss_text):].strip(" :.-")
        if segment:
            return segment[:220].rstrip(" ,.;") + "."

    return cleaned[:220].rstrip(" ,.;") + "."

def build_local_sign_answer(user_message: str, sources: list) -> str:
    if not sources:
        return "I’m having trouble reaching the AI service right now. Please try again in a moment."

    top = sources[0]
    gloss = top.get("gloss", "this sign")
    page = top.get("page", 0)
    description = concise_sign_description(gloss, top.get("description", ""))

    if description:
        answer = f"To sign \"{top.get('english') or gloss.lower()}\" in Ghana Sign Language, {description.lower()}"
    else:
        answer = f"I found the GSL dictionary entry for {gloss}, but I don't have a clean step-by-step description for it right now."

    if page:
        answer += f"\n\nYou can open the dictionary entry for \"{gloss}\" on page {page} to see diagrams."
    else:
        answer += f"\n\nYou can open the dictionary entry for \"{gloss}\" to see diagrams."

    return answer

def is_sign_related_query(message: str) -> bool:
    text = (message or "").lower()
    patterns = [
        r"\bhow\s+do\s+i\s+sign\b",
        r"\bhow\s+to\s+sign\b",
        r"\bsign\s+language\b",
        r"\bgsl\b",
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
    if is_dictionary_count_question(message):
        return {
            "answer": build_dictionary_count_answer(),
            "sources": [],
            "used_fallback": True
        }
    if sources and is_sign_related_query(message):
        return {
            "answer": build_local_sign_answer(message, sources),
            "sources": sources,
            "used_fallback": True
        }
    local_general = build_local_general_answer(message)
    if local_general:
        return {
            "answer": local_general,
            "sources": [],
            "used_fallback": True
        }
    return {
        "answer": "I’m having trouble reaching the AI service right now. Please try again in a moment.",
        "sources": sources or [],
        "used_fallback": True
    }

@router.post("/chat")
async def chat(data: dict):
    user_message = data.get("message", "")
    if is_dictionary_count_question(user_message):
        return {
            "answer": build_dictionary_count_answer(),
            "sources": [],
            "used_fallback": True
        }

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
