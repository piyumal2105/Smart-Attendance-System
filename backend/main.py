# Fix for ChromaDB requiring newer sqlite3
import sys
import os
import ctypes

# Fix for Protobuf conflict (MediaPipe vs others)
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

# Attempt to force-load the newer sqlite3.dll from specific paths
# This trick helps when the OS loader insists on using the system python's sqlite3.dll
try:
    # Try the one we placed in venv/DLLs
    ctypes.CDLL(r'c:\Users\chath\Desktop\Research\Code\venv\DLLs\sqlite3.dll')
except Exception:
    try:
        # Fallback to CWD
        ctypes.CDLL(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sqlite3.dll'))
    except Exception:
        pass

try:
    __import__('pysqlite3')
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
except ImportError:
    pass

# Fix for ChromaDB requiring newer sqlite3
try:
    __import__('pysqlite3')
    import sys
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import performance module routes
from modules.performance.routes import router as performance_router

# Teacher behavior API
try:
    from modules.teacher_behavior.api import router as teacher_behavior_router
except Exception:
    teacher_behavior_router = None
# teacher_behavior_router = None

from modules.engagement.run_inference import run_inference, LATEST_STATS, STATS_HISTORY, LATEST_GROUP_STATS, set_group_visualization


# def set_visual_style(style: str): pass
# def set_zone_boundaries(back_split: float, front_split: float): pass
from pydantic import BaseModel

# Attendance router
# Attendance router
from modules.attendance.routes import router as attendance_router

# Auth router
from modules.auth.routes import router as auth_router
from database import engine, Base, SessionLocal
from modules.auth.seeder import seed_users

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EduMonitor Backend", description="Classroom engagement and AI-powered lecture assistant")


# Startup event to check dependencies
@app.on_event("startup")
async def startup_event():
    """Check dependencies on startup and log their status."""
    logger.info("=" * 60)
    logger.info("EduMonitor Backend Starting")
    logger.info("=" * 60)
    
    # Check Ollama availability
    try:
        from modules.performance.llm_service import check_ollama_connection, get_available_models
        ollama_ok = check_ollama_connection()
        if ollama_ok:
            models = get_available_models()
            logger.info(f"✅ Ollama LLM is available. Models: {models}")
        else:
            logger.warning("⚠️  Ollama LLM is NOT running")
            logger.warning("   - AI Summary and Q&A features will be disabled")
            logger.warning("   - Upload and transcript storage will still work")
            logger.warning("   To enable LLM features:")
            logger.warning("   1. Install Ollama from https://ollama.com")
            logger.warning("   2. Run: ollama run llama3-it")
    except Exception as e:
        logger.warning(f"⚠️  Could not check Ollama status: {e}")
    
    logger.info("=" * 60)
    logger.info("Server ready at http://localhost:8000")
    logger.info("=" * 60)

    # Seed database
    db = SessionLocal()
    try:
        seed_users(db)
        logger.info("✅ Database seeded with default users")
    except Exception as e:
        logger.error(f"⚠️  Database seeding failed: {e}")
    finally:
        db.close()


# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ok for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(performance_router)


@app.get("/")
def read_root():
    return {"message": "Engagement Detection API is running"}

# Mount teacher behavior routes if available
if teacher_behavior_router is not None:
    app.include_router(teacher_behavior_router, prefix="/teacher_behavior")

# Server-side teacher behavior inference (stream + stats)
try:
    from modules.teacher_behavior.inference import run_teacher_inference, get_latest_stats
except Exception as e:
    print(f"CRITICAL: modules.teacher_behavior.inference failed to import: {e}")
    run_teacher_inference = None
    def get_latest_stats():
        return {"behavior": "Unavailable", "mobility": 0.0, "orientation": 0.0, "hand_speed": 0.0}



from fastapi.responses import JSONResponse


@app.get('/teacher_feed')
def teacher_feed():
    if run_teacher_inference is None:
        return StreamingResponse(iter([b"" ]), media_type="multipart/x-mixed-replace; boundary=frame")
    return StreamingResponse(run_teacher_inference(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get('/api/teacher_stats')
def teacher_stats():
    return JSONResponse(content=get_latest_stats())


@app.get('/api/teacher_stats/report')
def teacher_report():
    report_path = os.path.join(os.path.dirname(__file__), 'modules', 'teacher_behavior', 'reports', 'teacher_behavior_report.csv')
    if os.path.exists(report_path):
        return FileResponse(report_path, media_type='text/csv', filename='teacher_behavior_report.csv')
    return JSONResponse(content={"error": "Report not found"}, status_code=404)
@app.get("/stats")
def get_stats():
    return LATEST_STATS

@app.get("/stats/history")
def get_stats_history():
    return STATS_HISTORY

@app.get("/stats/groups")
def get_stats_groups():
    return LATEST_GROUP_STATS

class VisualizeRequest(BaseModel):
    enabled: bool

@app.post("/settings/visualize-groups")
def set_visualize_groups(req: VisualizeRequest):
    set_group_visualization(req.enabled)
    return {"status": "ok", "enabled": req.enabled}

class VisualStyleRequest(BaseModel):
    style: str

@app.post("/settings/visual-style")
def set_visual_style_endpoint(req: VisualStyleRequest):
    from modules.engagement.run_inference import set_visual_style
    set_visual_style(req.style)
    return {"status": "ok", "style": req.style}

class ZoneSettingsRequest(BaseModel):
    back_split: float
    front_split: float

@app.post("/settings/zones")
def set_zone_settings(req: ZoneSettingsRequest):
    from modules.engagement.run_inference import set_zone_boundaries
    set_zone_boundaries(req.back_split, req.front_split)
    return {"status": "ok", "zones": {"back": req.back_split, "front": req.front_split}}


@app.get("/video_feed")
def video_feed():
    if run_inference is None:
        return StreamingResponse(iter([b""]), media_type="multipart/x-mixed-replace; boundary=frame")
    return StreamingResponse(
        run_inference(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

app.include_router(attendance_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

