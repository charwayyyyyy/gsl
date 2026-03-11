import re
from typing import List

EN_TO_GSL = {
    "hello": ["HELLO"],
    "thank": ["THANK_YOU"],
    "thanks": ["THANK_YOU"],
    "please": ["PLEASE"],
    "sorry": ["SORRY"],
    "you": ["YOU"],
    "i": ["I"],
    "good morning": ["GOOD", "MORNING"],
    "good afternoon": ["GOOD", "AFTERNOON"],
    "good night": ["GOOD", "NIGHT"],
    "how are you": ["HOW", "YOU"],
    "my name": ["MY", "NAME"],
}

def fingerspell(word: str) -> str:
    return f"FS_{word.upper()}"

def to_gsl(text: str) -> List[str]:
    words = [re.sub(r"[^\w]", "", w.lower()) for w in text.split()]
    seq: List[str] = []
    for w in words:
        found = False
        for k, v in EN_TO_GSL.items():
            if w.startswith(k):
                seq.extend(v)
                found = True
                break
        if not found and w:
            seq.append(fingerspell(w))
    return seq

