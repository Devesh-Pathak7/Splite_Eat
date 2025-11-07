"""WebSocket Service - Real-time event broadcasting"""

from typing import Dict, List, Any
import logging
import json

logger = logging.getLogger(__name__)

# Global WebSocket connection manager
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[int, List[Any]] = {}  # restaurant_id -> [websockets]
    
    async def connect(self, websocket, restaurant_id: int):
        """Register a new WebSocket connection"""
        await websocket.accept()
        if restaurant_id not in self.active_connections:
            self.active_connections[restaurant_id] = []
        self.active_connections[restaurant_id].append(websocket)
        logger.info(f"WebSocket connected to restaurant {restaurant_id}. Total: {len(self.active_connections[restaurant_id])}")
    
    def disconnect(self, websocket, restaurant_id: int):
        """Remove a WebSocket connection"""
        if restaurant_id in self.active_connections:
            if websocket in self.active_connections[restaurant_id]:
                self.active_connections[restaurant_id].remove(websocket)
            if not self.active_connections[restaurant_id]:
                del self.active_connections[restaurant_id]
        logger.info(f"WebSocket disconnected from restaurant {restaurant_id}")
    
    async def broadcast(self, restaurant_id: int, event_type: str, data: Dict[str, Any]):
        """Broadcast message to all connections for a restaurant"""
        if restaurant_id not in self.active_connections:
            return
        
        message = {
            "type": event_type,
            "restaurant_id": restaurant_id,
            "data": data,
            "timestamp": data.get('timestamp', None)
        }
        
        dead_connections = []
        for connection in self.active_connections[restaurant_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                dead_connections.append(connection)
        
        # Clean up dead connections
        for conn in dead_connections:
            self.disconnect(conn, restaurant_id)
        
        if dead_connections:
            logger.info(f"Cleaned up {len(dead_connections)} dead connections")

# Global instance
ws_manager = WebSocketManager()

# Helper function for broadcasting events
async def broadcast_event(restaurant_id: int, event_type: str, data: Dict[str, Any]):
    """Broadcast an event to all connected clients for a restaurant"""
    await ws_manager.broadcast(restaurant_id, event_type, data)
    logger.debug(f"Broadcast {event_type} to restaurant {restaurant_id}")