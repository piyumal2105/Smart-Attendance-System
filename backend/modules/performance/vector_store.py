"""
Vector Store Service using ChromaDB
Handles embedding storage and similarity search for RAG.
Includes graceful error handling for missing dependencies.
"""
import logging
from typing import List, Dict, Optional, Tuple
import os
import hashlib

# Configure logging
logger = logging.getLogger(__name__)

# Initialize the embedding model (runs locally, free)
_embedding_model = None
_embedding_model_error = None


def get_embedding_model():
    """Lazy load the embedding model with error handling."""
    global _embedding_model, _embedding_model_error
    
    if _embedding_model_error:
        raise _embedding_model_error
    
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers embedding model...")
            # Using a lightweight but effective model
            _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Embedding model loaded successfully")
        except ImportError as e:
            _embedding_model_error = e
            logger.error("❌ sentence-transformers not installed. Run: pip install sentence-transformers")
            raise
        except Exception as e:
            _embedding_model_error = e
            logger.error(f"❌ Failed to load embedding model: {e}")
            raise
    
    return _embedding_model


# ChromaDB client (persistent storage)
_chroma_client = None
_chroma_error = None
_db_path = os.path.join(os.path.dirname(__file__), "vector_db")


def get_chroma_client():
    """Get or create ChromaDB client with persistent storage."""
    global _chroma_client, _chroma_error
    
    if _chroma_error:
        raise _chroma_error
    
    if _chroma_client is None:
        try:
            import chromadb
            os.makedirs(_db_path, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(path=_db_path)
            logger.info(f"✅ ChromaDB initialized at {_db_path}")
        except ImportError as e:
            _chroma_error = e
            logger.error("❌ chromadb not installed. Run: pip install chromadb")
            raise
        except Exception as e:
            _chroma_error = e
            logger.error(f"❌ Failed to initialize ChromaDB: {e}")
            raise
    
    return _chroma_client


def get_or_create_collection(collection_name: str = "lecture_content"):
    """Get or create a collection for storing lecture content."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"description": "Lecture slides and transcripts"}
    )


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    model = get_embedding_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()


def generate_doc_id(text: str, source: str) -> str:
    """Generate a unique document ID based on content hash."""
    content = f"{source}:{text[:100]}"
    return hashlib.md5(content.encode()).hexdigest()


def add_documents(
    texts: List[str],
    source: str = "unknown",
    collection_name: str = "lecture_content",
    metadata: Optional[Dict] = None
) -> int:
    """
    Add documents to the vector store.
    
    Args:
        texts: List of text chunks to store
        source: Source identifier (e.g., "slides", "transcript")
        collection_name: Name of the collection
        metadata: Additional metadata to store
    
    Returns:
        Number of documents added
    """
    if not texts:
        return 0
    
    try:
        collection = get_or_create_collection(collection_name)
        
        # Generate embeddings
        logger.debug(f"Generating embeddings for {len(texts)} texts")
        embeddings = generate_embeddings(texts)
        
        # Prepare documents
        ids = [generate_doc_id(text, source) for text in texts]
        metadatas = [
            {
                "source": source,
                "chunk_index": i,
                **(metadata or {})
            }
            for i in range(len(texts))
        ]
        
        # Add to collection (upsert to handle duplicates)
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        
        logger.info(f"Added {len(texts)} documents to vector store (source: {source})")
        return len(texts)
    
    except Exception as e:
        logger.error(f"Failed to add documents: {e}")
        raise


def search_similar(
    query: str,
    n_results: int = 5,
    collection_name: str = "lecture_content",
    source_filter: Optional[str] = None
) -> List[Tuple[str, float, Dict]]:
    """
    Search for similar documents.
    
    Args:
        query: Search query
        n_results: Number of results to return
        collection_name: Name of the collection
        source_filter: Optional filter by source type
    
    Returns:
        List of (document, distance, metadata) tuples
    """
    try:
        collection = get_or_create_collection(collection_name)
        
        # Generate query embedding
        query_embedding = generate_embeddings([query])[0]
        
        # Build where filter
        where_filter = None
        if source_filter:
            where_filter = {"source": source_filter}
        
        # Search
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "distances", "metadatas"]
        )
        
        # Format results
        output = []
        if results["documents"] and results["documents"][0]:
            for doc, dist, meta in zip(
                results["documents"][0],
                results["distances"][0],
                results["metadatas"][0]
            ):
                output.append((doc, dist, meta))
        
        logger.debug(f"Search returned {len(output)} results for query: {query[:50]}...")
        return output
    
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []


def get_all_content(
    collection_name: str = "lecture_content",
    limit: int = 100
) -> List[str]:
    """Get all documents from a collection."""
    try:
        collection = get_or_create_collection(collection_name)
        results = collection.get(limit=limit, include=["documents"])
        return results.get("documents", [])
    except Exception as e:
        logger.error(f"Failed to get content: {e}")
        return []


def get_collection_stats(collection_name: str = "lecture_content") -> Dict:
    """Get statistics about a collection."""
    try:
        collection = get_or_create_collection(collection_name)
        count = collection.count()
        return {
            "name": collection_name,
            "document_count": count
        }
    except Exception as e:
        logger.warning(f"Failed to get stats: {e}")
        return {
            "name": collection_name,
            "document_count": 0,
            "error": str(e)
        }


def clear_collection(collection_name: str = "lecture_content") -> bool:
    """Clear all documents from a collection."""
    try:
        client = get_chroma_client()
        client.delete_collection(collection_name)
        logger.info(f"Cleared collection: {collection_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to clear collection: {e}")
        return False
