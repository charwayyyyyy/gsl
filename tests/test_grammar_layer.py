import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.nlp.gsl_to_en import to_english
from backend.nlp.en_to_gsl import to_gsl

def test_gsl_to_english_basic():
    assert to_english(["HELLO", "YOU"]).startswith("Hello")

def test_english_to_gsl_fingerspell():
    seq = to_gsl("hello friend")
    assert "HELLO" in seq
    assert any(s.startswith("FS_") for s in seq)

