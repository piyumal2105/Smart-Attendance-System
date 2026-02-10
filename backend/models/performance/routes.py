"""
Performance Module API Routes
Handles lecture content upload, transcript processing, and AI-powered summarization/Q&A.
Gracefully handles cases when Ollama LLM is not available.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import logging

from .document_processor import process_document
from .vector_store import (
    add_documents, 
    search_similar, 
    get_all_content, 
    get_collection_stats,
    clear_collection
)
from .content_filter import filter_and_clean_transcript
from .llm_service import (
    check_ollama_connection,
    is_ollama_available,
    generate_summary,
    answer_question,
    get_available_models
)

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])


class TranscriptRequest(BaseModel):
    """Request body for transcript submission."""
    transcript: str
    use_llm_filter: bool = True


class QuestionRequest(BaseModel):
    """Request body for asking questions."""
    question: str


class StatusResponse(BaseModel):
    """Generic status response."""
    success: bool
    message: str
    data: Optional[dict] = None


@router.get("/health")
async def health_check():
    """Check health of the performance module and dependencies."""
    ollama_status = check_ollama_connection()
    vector_stats = get_collection_stats()
    models = get_available_models() if ollama_status else []
    
    status_message = "healthy" if ollama_status else "degraded (LLM unavailable)"
    
    return {
        "status": status_message,
        "ollama_connected": ollama_status,
        "ollama_models": models,
        "vector_store": vector_stats,
        "message": "All features available" if ollama_status else "Upload/storage works, but summary/Q&A requires Ollama LLM"
    }


@router.post("/upload", response_model=StatusResponse)
async def upload_lecture_slides(file: UploadFile = File(...)):
    """
    Upload lecture slides (PDF) for processing and storage.
    Extracts text, chunks it, and stores embeddings in vector DB.
    This works WITHOUT Ollama - only embeddings are needed.
    """
    # Validate file type
    if not file.filename.lower().endswith(('.pdf', '.txt')):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and TXT files are supported"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Process document into chunks
        chunks = process_document(content, file.filename)
        
        if not chunks:
            return StatusResponse(
                success=False,
                message="No text content could be extracted from the file"
            )
        
        # Store in vector database (uses sentence-transformers, not Ollama)
        num_stored = add_documents(
            texts=chunks,
            source="slides",
            metadata={"filename": file.filename}
        )
        
        logger.info(f"Uploaded and stored {num_stored} chunks from {file.filename}")
        
        return StatusResponse(
            success=True,
            message=f"Successfully processed and stored {num_stored} content chunks",
            data={
                "filename": file.filename,
                "chunks_stored": num_stored,
                "sample_chunk": chunks[0][:200] + "..." if chunks else None
            }
        )
    
    except ValueError as e:
        logger.error(f"Upload validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.post("/transcript", response_model=StatusResponse)
async def submit_transcript(request: TranscriptRequest):
    """
    Submit live transcript text for processing.
    Filters the transcript to extract meaningful content and stores it.
    Works without Ollama (falls back to regex-based filtering).
    """
    if not request.transcript or len(request.transcript.strip()) < 10:
        return StatusResponse(
            success=False,
            message="Transcript is too short or empty"
        )
    
    try:
        # Check if LLM is available for filtering
        llm_available = is_ollama_available()
        use_llm = request.use_llm_filter and llm_available
        
        if request.use_llm_filter and not llm_available:
            logger.info("LLM not available, using regex-based transcript filtering")
        
        # Filter the transcript (works with or without LLM)
        cleaned_content = filter_and_clean_transcript(
            request.transcript,
            use_llm=use_llm
        )
        
        if not cleaned_content:
            return StatusResponse(
                success=False,
                message="No meaningful content extracted from transcript"
            )
        
        # Store in vector database
        num_stored = add_documents(
            texts=[cleaned_content],
            source="transcript",
            metadata={"type": "live_speech", "llm_filtered": use_llm}
        )
        
        logger.info(f"Stored transcript: {num_stored} chunks (LLM filter: {use_llm})")
        
        return StatusResponse(
            success=True,
            message="Transcript processed and stored successfully" + (" (regex filter - LLM unavailable)" if not use_llm else ""),
            data={
                "original_length": len(request.transcript),
                "cleaned_length": len(cleaned_content),
                "chunks_stored": num_stored,
                "llm_filtered": use_llm,
                "preview": cleaned_content[:200] + "..." if len(cleaned_content) > 200 else cleaned_content
            }
        )
    
    except Exception as e:
        logger.error(f"Transcript processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@router.get("/summary")
async def get_summary():
    """
    Generate a summary of all stored lecture content.
    Returns a streaming response as the LLM generates the summary.
    REQUIRES Ollama to be running.
    """
    # Check Ollama connection
    if not is_ollama_available():
        logger.warning("Summary requested but Ollama is not available")
        # Return a helpful message as streaming response instead of error
        def unavailable_message():
            message = "Ollama LLM is not available. To enable AI summaries:\n\n"
            message += "1. Install Ollama from https://ollama.com\n"
            message += "2. Run: ollama run llama3-it\n"
            message += "3. Refresh this page"
            yield f"data: {json.dumps({'text': message})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            unavailable_message(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        )
    
    # Get all stored content
    all_content = get_all_content(limit=50)
    
    if not all_content:
        def no_content_message():
            yield f"data: {json.dumps({'text': 'No lecture content found. Please upload slides or submit transcripts first.'})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            no_content_message(),
            media_type="text/event-stream"
        )
    
    # Combine content for context
    context = "\n\n---\n\n".join(all_content[:20])  # Limit context size
    
    logger.info(f"Generating summary for {len(all_content)} content chunks")
    
    # Stream the summary
    def generate():
        try:
            for chunk in generate_summary(context):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Summary generation error: {e}")
            yield f"data: {json.dumps({'text': f'[Error generating summary: {str(e)}]'})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/ask")
async def ask_question(request: QuestionRequest):
    """
    Ask a question about the lecture content.
    Uses RAG to retrieve relevant content and streams the answer.
    REQUIRES Ollama to be running.
    """
    if not request.question or len(request.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Question is too short")
    
    # Check Ollama connection
    if not is_ollama_available():
        logger.warning("Question asked but Ollama is not available")
        def unavailable_message():
            message = "Ollama LLM is not available. To enable Q&A:\n\n"
            message += "1. Install Ollama from https://ollama.com\n"
            message += "2. Run: ollama run llama3-it\n"
            message += "3. Try asking again"
            yield f"data: {json.dumps({'text': message})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            unavailable_message(),
            media_type="text/event-stream"
        )
    
    # Search for relevant content
    search_results = search_similar(request.question, n_results=5)
    
    if not search_results:
        def no_content_message():
            yield f"data: {json.dumps({'text': 'No relevant content found. Please upload lecture materials first.'})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            no_content_message(),
            media_type="text/event-stream"
        )
    
    # Build context from search results
    context_parts = [doc for doc, dist, meta in search_results]
    context = "\n\n---\n\n".join(context_parts)
    
    logger.info(f"Answering question with {len(search_results)} context chunks")
    
    # Stream the answer
    def generate():
        try:
            for chunk in answer_question(context, request.question):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Q&A generation error: {e}")
            yield f"data: {json.dumps({'text': f'[Error generating answer: {str(e)}]'})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/stats")
async def get_stats():
    """Get statistics about stored content."""
    stats = get_collection_stats()
    ollama_status = is_ollama_available()
    
    return {
        "success": True,
        "data": {
            **stats,
            "llm_available": ollama_status
        }
    }


@router.delete("/clear")
async def clear_content():
    """Clear all stored lecture content."""
    try:
        success = clear_collection()
        logger.info("Cleared all lecture content")
        return StatusResponse(
            success=success,
            message="Content cleared successfully" if success else "Failed to clear content"
        )
    except Exception as e:
        logger.error(f"Error clearing content: {e}")
        return StatusResponse(
            success=False,
            message=f"Error clearing content: {str(e)}"
        )
