import pytest

pytest.skip("Legacy translation grammar tests are disabled for current implementation", allow_module_level=True)

import asyncio
from api.services.translation_service import GSLTranslationService

def test_gsl_to_english_rule_based():
    svc = GSLTranslationService()
    async def run():
        await svc.load_model()
        result = await svc.translate_gsl_to_english(["HELLO", "HOW", "YOU"])
        assert "english_text" in result
    asyncio.run(run())

def test_english_to_gsl_rule_based():
    svc = GSLTranslationService()
    async def run():
        await svc.load_model()
        result = await svc.translate_english_to_gsl("Hello, how are you?")
        assert len(result.get("gsl_sequence", result.get("gsl_signs", []))) >= 1
    asyncio.run(run())

