from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict
import os
import json

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
        """
        Generic method for sending any JSON payload
        (e.g. 'past_order').
        """
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_json(data)

# ---------------------------------------------------------------------
# Create FastAPI and mount the "frontend" folder to serve static files.
# ---------------------------------------------------------------------
app = FastAPI(title="app")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Serve index.html at the root ("/")
@app.get("/")
async def root():
    return FileResponse("frontend/index.html")

# If your entire site is on the same domain,
# typically you don't need strict CORS rules.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the WebSocket manager and ChatService
manager = ConnectionManager()
chat_service = ChatService(manager)

# WebSocket endpoint for order updates
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Keep the connection alive by reading messages
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id)

# -------------------------------
#  API endpoints
# -------------------------------
class UserMessage(BaseModel):
    session_id: str
    message: str

@app.post("/start/")
async def start_session():
    session_id = chat_service.start_session()
    return {"session_id": session_id, "message": "Session started"}

@app.post("/send/")
async def send_message(user_input: UserMessage):
    response = await chat_service.process_message(user_input.session_id, user_input.message)
    # Order updates are sent via WebSocket
    return {"ai_response": response}

@app.post("/end/")
async def end_session(session_id: str):
    chat_service.end_session(session_id)
    manager.disconnect(session_id)
    return {"message": "Session ended and memory cleared."}

# ---------------------------------------------------------------------
# Main entry point (if you run this file directly)
# ---------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
