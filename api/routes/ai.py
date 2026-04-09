import os
import requests
import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def handle_fallback(message, reason=""):
    logger.warning(f"Using fallback response. Reason: {reason}")
    msg = str(message).lower()
    
    text = "Hello! How can I help you with Ghana Sign Language today?"
    if "help" in msg:
        text = "You can use Sign → Speech, Speech → Sign, or Text → Sign. I can help answer questions about the app!"
    elif "sign" in msg or "gsl" in msg:
        text = "Ghana Sign Language is incredibly nuanced! If you need to translate, you can try our translation modes on the Home screen."
        
    return {
        "fallback": True,
        "candidates": [
            {
             "content": {
                "parts": [{"text": text}]
              }
            }
        ]
    }

@router.post("/chat")
async def chat(data: dict):
    user_message = data.get("message")
    
    if not GEMINI_API_KEY:
        return handle_fallback(user_message, "No API key configured.")

    # Using gemini-pro or gemini-2.0-flash mapping based on what is available
    # Using gemini-pro as specified in the instruction snippet
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={GEMINI_API_KEY}"
    
    # We should pass some context to the model to act as the assistant
    # Gemini Pro allows system instructions, but for simple generateContent we can just prepend it
    prompt = f"You are a helpful assistant for SignBridge Ghana, a real-time Ghanaian Sign Language interpreter. Keep your answers concise, clear, and friendly. User says: {user_message}"

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code != 200:
            logger.error(f"Gemini API error: {response.text}")
            return handle_fallback(user_message, "API connection issue.")
            
        return response.json()

    except requests.exceptions.RequestException as e:
        logger.error(f"Request to Gemini failed: {str(e)}")
        return handle_fallback(user_message, "Service unavailable.")
