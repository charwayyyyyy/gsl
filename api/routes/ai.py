import os
import json
import logging
import requests
from fastapi import APIRouter
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DICTIONARY_PATH = Path("data") / "processed" / "gsl_dictionary.json"

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

def handle_fallback(message, sources=None, reason=""):
    logger.warning(f"Using fallback response. Reason: {reason}")
    msg = str(message).lower()
    sources = sources or []
    
    if len(sources) > 0:
        ans = f"I found some information in the dictionary."
    else:
        ans = "I couldn't find that in the current Ghana Sign Language dictionary dataset."
        if "hello" in msg or "hi" in msg:
            ans = "Hello! How can I help you with Ghana Sign Language today?"
        elif "help" in msg:
            ans = "You can use Sign → Speech, Speech → Sign, or Text → Sign. I can help answer questions about the app!"
        elif "sign" in msg or "gsl" in msg:
            ans = "Ghana Sign Language is beautifully nuanced! If you need to translate, you can try our translation modes on the Home screen or look up a specific word here."
            
    return {
        "answer": ans,
        "sources": sources,
        "used_fallback": True
    }

@router.post("/chat")
async def chat(data: dict):
    user_message = data.get("message", "")
    
    # 1. Retrieve context
    sources = search_dictionary(user_message)
    
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
        "You are the SignBridge Assistant for Ghana Sign Language (GSL). "
        "You ONLY use the provided dictionary context to answer queries about signs. "
        "If the user asks how to describe a sign, rely solely on the Description provided below. "
        "If no dictionary entries match and the user asks for a sign, politely say 'I couldn't find that sign in the current GSL dictionary dataset.' "
        "Do NOT invent ASL or generic signs. "
        "Keep language friendly, clear, and educational. Format instructions beautifully."
    )
    
    prompt = f"User Question: {user_message}\n\nRetrieved GSL Dictionary Context:\n{context_text if sources else 'No matching entries found.'}"

    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "systemInstruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    try:
        response = requests.post(url, json=payload, timeout=15)
        
        if response.status_code != 200:
            logger.error(f"Gemini API error ({response.status_code}): {response.text}")
            # Try falling back to gemini-pro if 2.0-flash isn't available
            if "not found" in response.text.lower() or response.status_code == 404:
                url_pro = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"
                # gemini-pro has slightly different payload requirement (no systemInstruction prop directly often)
                payload_pro = {
                    "contents": [{"parts": [{"text": f"System: {system_instruction}\n\n{prompt}"}]}]
                }
                response = requests.post(url_pro, json=payload_pro, timeout=15)
                
            if response.status_code != 200:
                logger.error(f"Gemini API fallback error: {response.text}")
                return handle_fallback(user_message, sources, "API connection issue.")
            
        json_data = response.json()
        
        # Extract text from standard Gemini format
        try:
            text = json_data["candidates"][0]["content"]["parts"][0]["text"]
            return {
                "answer": text,
                "sources": sources,
                "used_fallback": False
            }
        except (KeyError, IndexError) as e:
            logger.error(f"Failed to parse Gemini response: {json_data}")
            return handle_fallback(user_message, sources, "Parsing error.")

    except requests.exceptions.RequestException as e:
        logger.error(f"Request to Gemini failed: {str(e)}")
        return handle_fallback(user_message, sources, "Service unavailable.")
