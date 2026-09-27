from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

from agent.config import get_settings


def get_model() -> BaseChatModel:
    settings = get_settings()
    if settings.llm_provider == "google":
        # The free tier returns 503 during demand spikes; retries absorb them.
        return ChatGoogleGenerativeAI(model=settings.llm_model, api_key=settings.google_api_key, max_retries=6)
    return ChatGroq(
        model=settings.llm_model,
        api_key=settings.groq_api_key,
        temperature=0,
        reasoning_format="hidden",
        max_retries=3,
    )
