from typing import List

COMMON_PHRASES = {
    "HELLO": "Hello",
    "GOODBYE": "Goodbye",
    "THANK_YOU": "Thank you",
    "PLEASE": "Please",
    "SORRY": "Sorry",
    "WHAT": "What",
    "WHO": "Who",
    "WHERE": "Where",
    "WHEN": "When",
    "WHY": "Why",
    "HOW": "How",
}

def apply_topic_comment(seq: List[str]) -> List[str]:
    # Placeholder: return as-is; real logic will reorder based on detected topic/comment
    return seq

def to_english(seq: List[str]) -> str:
    seq = apply_topic_comment(seq)
    words: List[str] = []
    for s in seq:
        if s in COMMON_PHRASES:
            words.append(COMMON_PHRASES[s])
        else:
            words.append(s.replace("_", " ").lower())
    sent = " ".join(words).strip()
    if sent:
        sent = sent[0].upper() + sent[1:]
        if sent[-1] not in ".!?":
            sent += "."
    return sent

