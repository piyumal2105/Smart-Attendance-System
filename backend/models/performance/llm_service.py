"""
LLM Service for Ollama Integration
Provides streaming text generation and chat completion via local Ollama instance.
Gracefully handles cases when Ollama is not installed or running.
"""
import requests
import json
import logging
from typing import Generator, List, Dict, Optional

# Configure logging
logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3-it"

# Global flag to track Ollama availability (reduces repeated connection attempts)
_ollama_available = None


def check_ollama_connection() -> bool:
    """Check if Ollama is running and accessible."""
    global _ollama_available
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        _ollama_available = response.status_code == 200
        if _ollama_available:
            logger.info("✅ Ollama LLM is connected and available")
        return _ollama_available
    except requests.exceptions.ConnectionError:
        _ollama_available = False
        logger.warning("⚠️ Ollama is not running. LLM features will be disabled. To enable, install Ollama from https://ollama.com and run: ollama run llama3-it")
        return False
    except requests.exceptions.RequestException as e:
        _ollama_available = False
        logger.warning(f"⚠️ Cannot connect to Ollama: {e}. LLM features disabled.")
        return False


def is_ollama_available() -> bool:
    """Quick check if Ollama was previously found to be available."""
    global _ollama_available
    if _ollama_available is None:
        return check_ollama_connection()
    return _ollama_available


def get_available_models() -> List[str]:
    """Get list of available models in Ollama."""
    if not is_ollama_available():
        return []
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if response.status_code == 200:
            data = response.json()
            models = [model["name"] for model in data.get("models", [])]
            logger.info(f"Available Ollama models: {models}")
            return models
        return []
    except requests.exceptions.RequestException:
        return []


def generate_streaming(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> Generator[str, None, None]:
    """
    Generate text with streaming response from Ollama.
    Yields text chunks as they arrive.
    Returns a graceful error message if Ollama is not available.
    """
    if not is_ollama_available():
        yield "[Ollama LLM is not available. Please install Ollama and run: ollama run llama3-it]"
        return

    url = f"{OLLAMA_BASE_URL}/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    
    if system_prompt:
        payload["system"] = system_prompt
    
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "response" in data:
                            yield data["response"]
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
    except requests.exceptions.ConnectionError:
        logger.warning("Lost connection to Ollama during generation")
        yield "[Connection to Ollama lost. Please check if it's still running.]"
    except requests.exceptions.Timeout:
        logger.warning("Ollama request timed out")
        yield "[Request timed out. The model may be loading or overloaded.]"
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama request error: {e}")
        yield f"[Error connecting to Ollama: {str(e)}]"


def generate_complete(
    prompt: str,
    model: str = DEFAULT_MODEL,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> str:
    """
    Generate text and return complete response (non-streaming).
    Returns empty string if Ollama is not available.
    """
    if not is_ollama_available():
        logger.info("Skipping LLM generation - Ollama not available")
        return ""
    
    chunks = list(generate_streaming(prompt, model, system_prompt, temperature, max_tokens))
    result = "".join(chunks)
    
    # Check if result is an error message
    if result.startswith("[") and result.endswith("]"):
        return ""
    
    return result


def chat_streaming(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.7
) -> Generator[str, None, None]:
    """
    Chat completion with streaming response.
    Messages format: [{"role": "user"|"assistant"|"system", "content": "..."}]
    """
    if not is_ollama_available():
        yield "[Ollama LLM is not available. Please install and run Ollama.]"
        return

    url = f"{OLLAMA_BASE_URL}/api/chat"
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature
        }
    }
    
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama chat error: {e}")
        yield f"[Error connecting to Ollama: {str(e)}]"


# RAG Prompt Templates
SUMMARY_SYSTEM_PROMPT = """You are an educational assistant that creates clear, concise summaries of lecture content.
Your summaries should:
- Highlight key concepts and main ideas
- Be well-organized with clear structure
- Use simple language accessible to students
- Include important definitions and examples mentioned"""

SUMMARY_PROMPT_TEMPLATE = """Based on the following lecture content, provide a comprehensive summary for students:

LECTURE CONTENT:
{context}

Please provide a well-structured summary covering the main topics and key points."""

QA_SYSTEM_PROMPT = """You are an educational assistant helping students understand lecture content.
Answer questions based ONLY on the provided context. If the answer is not in the context, say so.
Provide clear, educational explanations."""

QA_PROMPT_TEMPLATE = """Use the following lecture content to answer the student's question.
If the answer is not found in the content, acknowledge that and provide general guidance.

LECTURE CONTENT:
{context}

STUDENT QUESTION: {question}

Please provide a helpful, educational answer:"""

FILTER_SYSTEM_PROMPT = """You are a transcript processor. Your job is to:
1. Remove filler words (um, uh, like, you know, so, basically, etc.)
2. Fix grammar and sentence structure
3. Extract the meaningful educational content
4. Maintain the original meaning and key explanations
5. Return ONLY the cleaned, coherent text - no commentary"""

FILTER_PROMPT_TEMPLATE = """Clean the following raw speech transcript. Remove filler words, fix grammar, and extract only the meaningful educational content:

RAW TRANSCRIPT:
{transcript}

CLEANED CONTENT:"""


def generate_summary(context: str, model: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Generate a streaming summary of lecture content."""
    if not is_ollama_available():
        yield "[Summary generation requires Ollama LLM. Please install and run Ollama.]"
        return
    prompt = SUMMARY_PROMPT_TEMPLATE.format(context=context)
    yield from generate_streaming(prompt, model, SUMMARY_SYSTEM_PROMPT, temperature=0.5)


def answer_question(context: str, question: str, model: str = DEFAULT_MODEL) -> Generator[str, None, None]:
    """Answer a question based on lecture content with streaming response."""
    if not is_ollama_available():
        yield "[Q&A requires Ollama LLM. Please install and run Ollama to use this feature.]"
        return
    prompt = QA_PROMPT_TEMPLATE.format(context=context, question=question)
    yield from generate_streaming(prompt, model, QA_SYSTEM_PROMPT, temperature=0.3)


def filter_transcript(raw_transcript: str, model: str = DEFAULT_MODEL) -> str:
    """Filter raw transcript to extract meaningful content (non-streaming for processing)."""
    if not is_ollama_available():
        # Return empty to fall back to regex-based filtering
        logger.info("LLM not available for transcript filtering, using regex fallback")
        return ""
    prompt = FILTER_PROMPT_TEMPLATE.format(transcript=raw_transcript)
    return generate_complete(prompt, model, FILTER_SYSTEM_PROMPT, temperature=0.2, max_tokens=1024)


# Log initial Ollama status at module load
def _init_check():
    """Check Ollama availability on module load."""
    logger.info("Checking Ollama LLM availability...")
    check_ollama_connection()

# Don't block on startup - check lazily
