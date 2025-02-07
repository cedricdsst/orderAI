from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict
import os
import json
from edge_tts import Communicate
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()

import asyncio
import tempfile
from pathlib import Path
import base64

from services import ChatService

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_order_update(self, session_id: str, order_data: dict):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_json({
                "type": "order_update",
                "data": order_data
            })

    async def send_json(self, session_id: str, data: dict):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_json(data)

async def generate_tts(text: str) -> str:
    """Generate TTS and return as base64 encoded string"""
    try:
        # Create a temporary file for the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_path = temp_file.name

        # Generate audio using Edge TTS
        communicate = Communicate(text, "fr-FR-DeniseNeural")
        await communicate.save(temp_path)

        # Read the file and encode to base64
        with open(temp_path, "rb") as audio_file:
            audio_base64 = base64.b64encode(audio_file.read()).decode()

        # Clean up temp file
        os.unlink(temp_path)
        return audio_base64
    except Exception as e:
        print(f"TTS generation error: {e}")
        return ""

app = FastAPI(title="app")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
async def root():
    return FileResponse("frontend/index.html")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
chat_service = ChatService(manager)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id)

class UserMessage(BaseModel):
    session_id: str
    message: str

@app.post("/start/")
async def start_session():
    session_id = chat_service.start_session()
    return {"session_id": session_id, "message": "Session started"}

@app.post("/send/")
async def send_message(user_input: UserMessage):
    try:
        # Get AI response
        ai_response = await chat_service.process_message(user_input.session_id, user_input.message)
        
        # Generate audio for the response
        audio_base64 = await generate_tts(ai_response)
        
        # Get current order if it exists
        current_order = chat_service.get_order(user_input.session_id)
        
        # Return both text and audio
        return JSONResponse({
            "ai_response": ai_response,
            "audio_data": audio_base64,
            "order": current_order
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/end/")
async def end_session(session_id: str):
    chat_service.end_session(session_id)
    manager.disconnect(session_id)
    return {"message": "Session ended and memory cleared."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)