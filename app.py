# app.py
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services import ChatService
import os
import json
from typing import Dict

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
        Generic method for sending any JSON payload to the client
        (for example, 'past_order' notifications).
        """
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            await websocket.send_json(data)

# Initialize FastAPI and Connection Manager
app = FastAPI(title="OrderAI")
manager = ConnectionManager()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chat service instance with WebSocket manager
chat_service = ChatService(manager)

# WebSocket endpoint for order updates
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id)

# Start a new session
@app.post("/start/")
async def start_session():
    session_id = chat_service.start_session()
    return {"session_id": session_id, "message": "Session started"}

# Send a user message
class UserMessage(BaseModel):
    session_id: str
    message: str

@app.post("/send/")
async def send_message(user_input: UserMessage):
    response = await chat_service.process_message(user_input.session_id, user_input.message)
    # Note: Order updates are now sent through WebSocket
    return {"ai_response": response}

# End a session
@app.post("/end/")
async def end_session(session_id: str):
    chat_service.end_session(session_id)
    manager.disconnect(session_id)
    return {"message": "Session ended and memory cleared."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)