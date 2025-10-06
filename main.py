# Enhanced Hetzner Backend for FWEA-I Omnilingual Clean Editor
# Updated to work with Cloudflare Workers and Stripe integration

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import os
import io
import json
import re
import tempfile
import subprocess
import uuid
import requests
import asyncio
from typing import Optional, Dict, List
import logging
from datetime import datetime, timedelta
import stripe

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="FWEA-I Omnilingual Clean Editor Backend",
    description="AI-powered audio cleaning service",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID", "94ad1fffaa41132c2ff517ce46f76692")
CF_API_TOKEN = os.getenv("CF_API_TOKEN", "PZX0tilNCKHnZ-X4LD-iB6GhzpdcJuNlLONIz1ZE")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_live_...")
HETZNER_SERVER_URL = "https://178.156.190.229:8000"

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# Whisper model configuration
WHISPER_MODEL = "@cf/openai/whisper"

# Storage directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("processed", exist_ok=True)
os.makedirs("temp", exist_ok=True)

# Session storage (in production, use Redis or database)
active_sessions: Dict[str, Dict] = {}

# Enhanced multilingual profanity patterns
PROFANITY_PATTERNS = {
    "english": [
        r"\b(fuck|shit|bitch|asshole|cunt|motherfucker|dick|pussy|damn|hell|crap|ass|bastard)\b",
        r"\b(fucking|shitting|bitching|damning)\b"
    ],
    "spanish": [
        r"\b(puta|puto|pendejo|mierda|cabrón|coño|joder|hijo\s+de\s+puta)\b",
        r"\b(pinche|chingada|mamada|verga|culero)\b"
    ],
    "french": [
        r"\b(putain|merde|salope|con|connard|bordel|enculé)\b",
        r"\b(foutre|chier|baiser|niquer)\b"
    ],
    "portuguese": [
        r"\b(merda|caralho|porra|puta|filho\s+da\s+puta|cu|buceta)\b",
        r"\b(foder|cagar|porra|desgraça)\b"
    ],
    "german": [
        r"\b(scheiße|arschloch|hure|fotze|hurensohn|fick|verdammt)\b",
        r"\b(ficken|scheißen|hurerei)\b"
    ],
    "italian": [
        r"\b(merda|cazzo|puttana|stronzo|figlio\s+di\s+puttana|vaffanculo)\b",
        r"\b(fottere|cagare|incazzare)\b"
    ]
}

def detect_language(text: str) -> str:
    """Enhanced language detection"""
    patterns = {
        "english": r"\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were)\b",
        "spanish": r"\b(el|la|los|las|de|en|un|una|por|para|con|sin|es|son|fue|fueron)\b",
        "french": r"\b(le|la|les|de|du|des|un|une|dans|pour|avec|sans|est|sont|était)\b",
        "portuguese": r"\b(o|a|os|as|de|em|um|uma|para|com|sem|por|é|são|foi|eram)\b",
        "german": r"\b(der|die|das|den|dem|des|ein|eine|und|oder|in|mit|ist|sind|war)\b",
        "italian": r"\b(il|la|lo|gli|le|di|da|in|con|su|per|tra|è|sono|era|erano)\b"
    }
    
    max_matches = 0
    detected_lang = "english"
    
    for lang, pattern in patterns.items():
        matches = len(re.findall(pattern, text.lower()))
        if matches > max_matches:
            max_matches = matches
            detected_lang = lang
    
    return detected_lang

def detect_profanity(text: str, language: str = "english") -> List[Dict]:
    """Enhanced profanity detection with timestamps"""
    patterns = PROFANITY_PATTERNS.get(language, PROFANITY_PATTERNS["english"])
    found_words = []
    
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            found_words.append({
                "word": match.group(),
                "start_pos": match.start(),
                "end_pos": match.end(),
                "confidence": 0.95
            })
    
    return found_words

async def call_cloudflare_whisper(audio_data: bytes) -> Dict:
    """Call Cloudflare Workers AI Whisper model"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/{WHISPER_MODEL}"
    
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Convert audio to required format
    audio_array = list(audio_data)
    
    payload = {
        "audio": audio_array
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Cloudflare Whisper API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

def chunk_audio(audio_data: bytes, chunk_size: int = 1024*1024) -> List[bytes]:
    """Split large audio files into chunks"""
    chunks = []
    for i in range(0, len(audio_data), chunk_size):
        chunks.append(audio_data[i:i + chunk_size])
    return chunks

async def process_large_audio(audio_data: bytes) -> Dict:
    """Process large audio files with chunking"""
    if len(audio_data) <= 25 * 1024 * 1024:  # 25MB limit for single call
        return await call_cloudflare_whisper(audio_data)
    
    # Chunk processing for large files
    chunks = chunk_audio(audio_data, chunk_size=20*1024*1024)  # 20MB chunks
    transcriptions = []
    
    for i, chunk in enumerate(chunks):
        logger.info(f"Processing chunk {i+1}/{len(chunks)}")
        try:
            result = await call_cloudflare_whisper(chunk)
            transcriptions.append(result.get("result", {}).get("text", ""))
        except Exception as e:
            logger.warning(f"Chunk {i+1} failed: {str(e)}")
            transcriptions.append("")
    
    # Combine transcriptions
    combined_text = " ".join(filter(None, transcriptions))
    
    return {
        "result": {
            "text": combined_text,
            "word_count": len(combined_text.split())
        },
        "success": True
    }

@app.post("/preview")
async def preview_audio(audio: UploadFile = File(...)):
    """Process audio file and generate preview with explicit content detection"""
    
    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Validate file format
        valid_formats = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma']
        file_ext = audio.filename.split('.')[-1].lower()
        
        if file_ext not in valid_formats:
            raise HTTPException(status_code=400, detail=f"Unsupported format. Supported: {', '.join(valid_formats)}")
        
        # Read audio data
        audio_data = await audio.read()
        
        # Store session info
        active_sessions[session_id] = {
            "filename": audio.filename,
            "file_size": len(audio_data),
            "format": file_ext,
            "status": "processing",
            "created_at": datetime.utcnow(),
            "audio_data": audio_data
        }
        
        # Process with Whisper AI
        logger.info(f"Starting transcription for session {session_id}")
        whisper_result = await process_large_audio(audio_data)
        
        if not whisper_result.get("success", True):
            raise HTTPException(status_code=500, detail="Transcription failed")
        
        transcript = whisper_result.get("result", {}).get("text", "")
        word_count = whisper_result.get("result", {}).get("word_count", 0)
        
        # Detect language
        detected_language = detect_language(transcript)
        
        # Detect profanity
        profanity_found = detect_profanity(transcript, detected_language)
        
        # Update session
        active_sessions[session_id].update({
            "transcript": transcript,
            "language": detected_language,
            "profanity": profanity_found,
            "word_count": word_count,
            "status": "ready_for_preview"
        })
        
        return JSONResponse({
            "success": True,
            "session_id": session_id,
            "transcript": transcript[:500] + "..." if len(transcript) > 500 else transcript,
            "language": {
                "detected": detected_language,
                "confidence": 0.85  # Mock confidence
            },
            "explicit_content": {
                "found": len(profanity_found) > 0,
                "count": len(profanity_found),
                "words": [item["word"] for item in profanity_found[:5]]  # Limit for preview
            },
            "word_count": word_count,
            "preview_ready": True,
            "file_info": {
                "name": audio.filename,
                "size": len(audio_data),
                "format": file_ext
            }
        })
        
    except Exception as e:
        logger.error(f"Preview processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clean")
async def clean_audio(session_data: Dict):
    """Generate clean version of audio file"""
    
    session_id = session_data.get("session_id")
    if not session_id or session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[session_id]
    
    try:
        # Simulate audio cleaning process
        # In production, implement actual audio processing with FFmpeg
        logger.info(f"Cleaning audio for session {session_id}")
        
        session["status"] = "cleaning"
        
        # Simulate processing time
        await asyncio.sleep(2)
        
        # Mock cleaned audio generation
        # In production, process the actual audio with muted sections
        cleaned_file_path = f"processed/{session_id}_clean.{session['format']}"
        
        # For demo, copy original file
        with open(cleaned_file_path, "wb") as f:
            f.write(session["audio_data"])
        
        session.update({
            "status": "completed",
            "cleaned_file": cleaned_file_path,
            "processing_time": 45  # seconds
        })
        
        return JSONResponse({
            "success": True,
            "session_id": session_id,
            "status": "completed",
            "download_ready": True,
            "processing_time": 45,
            "file_size": session["file_size"]
        })
        
    except Exception as e:
        logger.error(f"Audio cleaning error: {str(e)}")
        session["status"] = "error"
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{session_id}")
async def download_clean_audio(session_id: str):
    """Download cleaned audio file"""
    
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[session_id]
    
    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Audio not ready for download")
    
    cleaned_file = session.get("cleaned_file")
    if not cleaned_file or not os.path.exists(cleaned_file):
        raise HTTPException(status_code=404, detail="Cleaned file not found")
    
    original_name = session["filename"]
    clean_name = f"clean_{original_name}"
    
    return FileResponse(
        cleaned_file,
        media_type="application/octet-stream",
        filename=clean_name,
        headers={"Content-Disposition": f"attachment; filename={clean_name}"}
    )

@app.get("/status/{session_id}")
async def get_session_status(session_id: str):
    """Get processing status for session"""
    
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = active_sessions[session_id]
    
    return JSONResponse({
        "session_id": session_id,
        "status": session["status"],
        "progress": {
            "transcription": 100 if "transcript" in session else 0,
            "cleaning": 100 if session["status"] == "completed" else 50 if session["status"] == "cleaning" else 0,
            "overall": 100 if session["status"] == "completed" else 75 if session["status"] == "cleaning" else 25
        },
        "created_at": session["created_at"].isoformat(),
        "file_info": {
            "name": session["filename"],
            "size": session["file_size"],
            "format": session["format"]
        }
    })

@app.delete("/session/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up session data and temporary files"""
    
    if session_id not in active_sessions:
        return JSONResponse({"message": "Session not found"})
    
    session = active_sessions[session_id]
    
    # Clean up files
    cleaned_file = session.get("cleaned_file")
    if cleaned_file and os.path.exists(cleaned_file):
        os.remove(cleaned_file)
    
    # Remove from active sessions
    del active_sessions[session_id]
    
    return JSONResponse({"message": "Session cleaned up successfully"})

# Background task to clean up old sessions
async def cleanup_old_sessions():
    """Clean up sessions older than 24 hours"""
    while True:
        try:
            current_time = datetime.utcnow()
            expired_sessions = []
            
            for session_id, session in active_sessions.items():
                if current_time - session["created_at"] > timedelta(hours=24):
                    expired_sessions.append(session_id)
            
            for session_id in expired_sessions:
                await cleanup_session(session_id)
                logger.info(f"Cleaned up expired session: {session_id}")
            
            # Sleep for 1 hour
            await asyncio.sleep(3600)
            
        except Exception as e:
            logger.error(f"Cleanup task error: {str(e)}")
            await asyncio.sleep(300)  # Sleep 5 minutes on error

@app.on_event("startup")
async def startup_event():
    """Start background cleanup task"""
    asyncio.create_task(cleanup_old_sessions())
    logger.info("FWEA-I Backend started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "active_sessions": len(active_sessions),
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile="path/to/private.key",
        ssl_certfile="path/to/certificate.crt"
    )
