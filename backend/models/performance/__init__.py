# Performance Module
# AI-powered lecture content processing with Ollama LLM and ChromaDB

from .routes import router
from .llm_service import (
    check_ollama_connection,
    generate_summary,
    answer_question,
    filter_transcript
)
from .vector_store import (
    add_documents,
    search_similar,
    get_all_content,
    get_collection_stats
)
from .document_processor import (
    extract_text_from_pdf,
    chunk_text,
    process_document
)
from .content_filter import (
    filter_and_clean_transcript,
    batch_filter_transcripts
)

__all__ = [
    'router',
    'check_ollama_connection',
    'generate_summary',
    'answer_question',
    'filter_transcript',
    'add_documents',
    'search_similar',
    'get_all_content',
    'get_collection_stats',
    'extract_text_from_pdf',
    'chunk_text',
    'process_document',
    'filter_and_clean_transcript',
    'batch_filter_transcripts'
]
