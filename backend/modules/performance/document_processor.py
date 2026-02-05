"""
Document Processor
Handles PDF text extraction and text chunking.
"""
import re
from typing import List, Optional
from PyPDF2 import PdfReader
import io


def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extract text content from a PDF file.
    
    Args:
        file_content: PDF file bytes
    
    Returns:
        Extracted text as string
    """
    try:
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
        
        return "\n\n".join(text_parts)
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    separator: str = "\n"
) -> List[str]:
    """
    Split text into overlapping chunks for embedding.
    
    Args:
        text: Text to chunk
        chunk_size: Target size of each chunk in characters
        overlap: Number of characters to overlap between chunks
        separator: Preferred split point
    
    Returns:
        List of text chunks
    """
    if not text or not text.strip():
        return []
    
    # Clean the text
    text = re.sub(r'\s+', ' ', text).strip()
    
    # If text is shorter than chunk size, return as single chunk
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Calculate end position
        end = start + chunk_size
        
        # If we're not at the end, try to break at a sentence or word boundary
        if end < len(text):
            # Look for a good break point (sentence end, newline, or space)
            break_chars = ['. ', '! ', '? ', '\n', '; ', ', ', ' ']
            best_break = end
            
            for char in break_chars:
                pos = text.rfind(char, start + chunk_size // 2, end)
                if pos != -1:
                    best_break = pos + len(char)
                    break
            
            end = best_break
        else:
            end = len(text)
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        # Move start position with overlap
        start = end - overlap if end < len(text) else len(text)
    
    return chunks


def process_document(file_content: bytes, filename: str) -> List[str]:
    """
    Process a document file and return text chunks.
    
    Args:
        file_content: File bytes
        filename: Name of the file
    
    Returns:
        List of text chunks ready for embedding
    """
    # Determine file type and extract text
    lower_filename = filename.lower()
    
    if lower_filename.endswith('.pdf'):
        text = extract_text_from_pdf(file_content)
    elif lower_filename.endswith('.txt'):
        text = file_content.decode('utf-8', errors='ignore')
    else:
        raise ValueError(f"Unsupported file type: {filename}")
    
    # Chunk the text
    chunks = chunk_text(text)
    
    return chunks
