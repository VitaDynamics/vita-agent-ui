import asyncio
import websockets
import json
import sys
import uuid
import os

async def stream_data():
    uri = os.getenv("WS_URI", "ws://localhost:61111")
    
    # Generate or read Client ID
    client_id = sys.argv[1] if len(sys.argv) > 1 else f"agent_{str(uuid.uuid4())[:8]}"
    client_name = f"Agent {client_id}"
    
    steps = [
        {"type": "user_request", "content": "Can you analyze this image for me and then take an action?"},
        {"type": "token", "content": "Hello from Python! "},
        {"type": "token", "content": "I "},
        {"type": "token", "content": "am "},
        {"type": "token", "content": "streaming "},
        {"type": "token", "content": "data "},
        {"type": "token", "content": "now.\n"},
        {"type": "token", "content": "<thinking>"},
        {"type": "token", "content": "Connecting "},
        {"type": "token", "content": "to "},
        {"type": "token", "content": "vision "},
        {"type": "token", "content": "and "},
        {"type": "token", "content": "action "},
        {"type": "token", "content": "tools... "},
        {"type": "token", "content": "</thinking>"},

        # VisionAnalyze - VQA mode (mode = 1) - STREAMING EXAMPLE
        {
            "type": "tool_call_chunk",
            "name": "vision_analyze",
            "id": "call_py_vqa_1",
            "args": ""  # Start with empty args, or just name/id
        },
        # Send args in chunks
        {"type": "tool_call_chunk", "id": "call_py_vqa_1", "args": "{\n"},
        {"type": "tool_call_chunk", "id": "call_py_vqa_1", "args": "  \"mode\": 1,\n"},
        {"type": "tool_call_chunk", "id": "call_py_vqa_1", "args": "  \"image\": \"https://images.unsplash.com/photo-1542281286-9e0a56e2e1a1?q=80&w=2000&auto=format&fit=crop\",\n"},
        {"type": "tool_call_chunk", "id": "call_py_vqa_1", "args": "  \"question\": \"What kind of landscape is this?\"\n"},
        {"type": "tool_call_chunk", "id": "call_py_vqa_1", "args": "}"},

        {
            "type": "tool_result",
            "id": "call_py_vqa_1",
            "result": {
                "status": "ok",
                "data": {
                    "answer": "A mountainous landscape with dense forests and a lake."
                },
                "message": "Vision VQA analysis completed from Python client."
            },
        },

        # VisionAnalyze - Grounding mode (mode = "grounding")
        {
            "type": "tool_call", # Keeping one legacy style to test backward compatibility if we wanted, but let's stick to chunks as requested? 
            # Actually, let's stream this one too to be consistent.
            "name": "vision_analyze",
            "id": "call_py_ground_1",
            "args": {
                "mode": "grounding",
                "image": "https://images.unsplash.com/photo-1542281286-9e0a56e2e1a1?q=80&w=2000&auto=format&fit=crop",
                "question": "Where is the mountain peak?"
            },
        },
        {
            "type": "tool_result",
            "id": "call_py_ground_1",
            "result": {
                "status": "ok",
                "data": {
                    "objects": [
                        {
                            "label": "mountain peak",
                            "pixel_x": 1400,
                            "pixel_y": 250,
                            "distance": 120.0,
                            "angle_deg": 0.0,
                            "confidence": 0.96,
                        }
                    ],
                    "detection_count": 1,
                },
                "message": "Grounded the mountain peak position from Python client."
            },
        },

        # TakeAction tool example - Streaming
        {"type": "tool_call_chunk", "name": "take_action", "id": "call_py_action_1", "args": "{\"action_name\": "}, 
        {"type": "tool_call_chunk", "id": "call_py_action_1", "args": "\"Wave\"}"},
        
        {
            "type": "tool_result",
            "id": "call_py_action_1",
            "result": {
                "status": "ok",
                "data": {
                    "action_name": "Wave",
                },
                "message": "Successfully executed action 'Wave' from Python client.",
            },
        },

        # ControlNav Tool - Navigation - Streaming
        {"type": "tool_call_chunk", "name": "control_nav", "id": "call_py_nav_1", "args": "{"},
        {"type": "tool_call_chunk", "id": "call_py_nav_1", "args": "\"x\": 2.5, "},
        {"type": "tool_call_chunk", "id": "call_py_nav_1", "args": "\"y\": 1.0}"},

        # Simulate loading by sending tokens between request and result
        {"type": "token", "content": "Navigating "},
        {"type": "token", "content": "to "},
        {"type": "token", "content": "target "},
        {"type": "token", "content": "location...\n"},
        {
            "type": "tool_result",
            "id": "call_py_nav_1",
            "result": "✅ Navigating to (x=2.5m forward, y=1.0m left)",
        },

        # ControlNav Tool - Rotation
        {
            "type": "tool_call",
            "name": "control_nav",
            "id": "call_py_rot_1",
            "args": {
                "angle": -45,
            },
        },
        {"type": "token", "content": "Rotating "},
        {"type": "token", "content": "robot...\n"},
        {
            "type": "tool_result",
            "id": "call_py_rot_1",
            "result": "✅ Rotated 45° Right",
        },

        # Generic/custom tool example still works and falls back to GenericTool
        {"type": "token", "content": "\nNow trying a generic tool...\n"},
        {
            "type": "tool_call",
            "name": "custom_search",
            "id": "call_py_2",
            "args": {"query": "Latest AI agents", "filters": ["news", "code"]},
        },
        {
            "type": "tool_result",
            "id": "call_py_2",
            "result": {"hits": 5, "top_hit": "LangChain Agent"},
        },
    ]

    async with websockets.connect(uri, ping_interval=None) as websocket:
        print(f"Connected to {uri}")

        # Register message
        register_msg = {
            "type": "register",
            "id": client_id,
            "name": client_name
        }
        await websocket.send(json.dumps(register_msg))
        print(f"Sent: {register_msg}")
        
        last_ping = asyncio.get_running_loop().time()

        for step in steps:
            await websocket.send(json.dumps(step))
            print(f"Sent: {step}")
            # Periodically send pings to maintain the long-lived connection
            now = asyncio.get_event_loop().time()
            if now - last_ping > 20:
                await websocket.ping()
                last_ping = now
            await asyncio.sleep(0.2)

        # 长时间保持连接示例
        while True:
            await asyncio.sleep(20)
            await websocket.ping()
            print("Sent heartbeat ping")

        print("Stream finished")

if __name__ == "__main__":
    try:
        asyncio.run(stream_data())
    except KeyboardInterrupt:
        print("Stream stopped")
    except Exception as e:
        print(f"Error: {e}")
