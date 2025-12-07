require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Stream Viewer Backend');
});

// Relax HTTP idle timeouts so WebSocket upgrades are not closed prematurely
const HTTP_IDLE_TIMEOUT_MS = Number(process.env.HTTP_IDLE_TIMEOUT_MS || 300000); // default 5m
server.keepAliveTimeout = HTTP_IDLE_TIMEOUT_MS;
server.headersTimeout = HTTP_IDLE_TIMEOUT_MS + 1000; // must be > keepAliveTimeout
server.requestTimeout = 0; // disable per-request timeout

const wss = new WebSocket.Server({ server });

const HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS || 30000);

// Map to store connected "agent/source" clients
// Key: WebSocket object, Value: { id: string, name: string, type: 'source' | 'viewer' }
const clients = new Map();

// Simple ping/pong to keep connections alive
function markAlive() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.isAlive = true;
    ws.on('pong', markAlive);

    // Default metadata
    clients.set(ws, {
        id: 'anon_' + Date.now(),
        name: 'Anonymous',
        type: 'viewer' // Default to viewer until they register as source
    });

    ws.send(JSON.stringify({ type: 'system', content: 'Connected to Stream Server...\n' }));
    // Send client list ONLY to the new client (don't spam everyone else)
    sendClientListTo(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Handle Registration
            if (data.type === 'register') {
                const clientInfo = clients.get(ws);
                clientInfo.id = data.id || clientInfo.id;
                clientInfo.name = data.name || `Agent ${data.id}`;
                clientInfo.type = 'source'; // registered clients are sources
                clients.set(ws, clientInfo);

                console.log(`Client registered: ${clientInfo.name} (${clientInfo.id})`);
                broadcastClientList();
                return;
            }

            // For source clients, wrap and broadcast their messages
            const sender = clients.get(ws);
            if (sender.type === 'source') {
                const wrappedMessage = {
                    type: 'broadcast',
                    clientId: sender.id,
                    clientName: sender.name,
                    message: data
                };

                // Broadcast to ALL connected clients (viewers AND other sources if needed)
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(wrappedMessage));
                    }
                });
            } else {
                // Should viewers be able to send things? Maybe control commands later.
                // For now, ignore or log.
            }

        } catch (e) {
            console.error("Invalid JSON received", e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const clientInfo = clients.get(ws);

        // Only broadcast if a SOURCE disconnected
        // If a viewer disconnects, nobody cares (except the server logs)
        if (clientInfo && clientInfo.type === 'source') {
            clients.delete(ws);
            broadcastClientList();
        } else {
            clients.delete(ws);
        }
    });
});

const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.isAlive === false) {
            return client.terminate();
        }
        client.isAlive = false;
        client.ping();
    });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

function sendClientListTo(clientSocket) {
    const activeSources = [];
    clients.forEach((info) => {
        if (info.type === 'source') {
            activeSources.push({ id: info.id, name: info.name });
        }
    });

    const message = JSON.stringify({
        type: 'client_list',
        clients: activeSources
    });

    if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(message);
    }
}

function broadcastClientList() {
    const activeSources = [];
    clients.forEach((info) => {
        if (info.type === 'source') {
            activeSources.push({ id: info.id, name: info.name });
        }
    });

    const message = JSON.stringify({
        type: 'client_list',
        clients: activeSources
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Mock Producer logic to simulate LangChain stream
// Mock Producer logic to simulate LangChain stream
function broadcastMock(data, mockId = 'mock_1', mockName = 'Mock Agent') {
    const wrapped = {
        type: 'broadcast',
        clientId: mockId,
        clientName: mockName,
        message: data
    };
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(wrapped));
        }
    });
}

// Endpoint or Trigger to start a mock stream
// specific to "Simulating LangChain"
// We will expose a simple interval loop to test the frontend
const startMockStream = () => {
    console.log("Starting mock stream...");

    const steps = [
        { type: 'token', content: "Hello! " },
        { type: 'token', content: "I " },
        { type: 'token', content: "will " },
        { type: 'token', content: "check " },
        { type: 'token', content: "that " },
        { type: 'token', content: "for " },
        { type: 'token', content: "you.\n" },
        { type: 'token', content: "<thinking>" },
        { type: 'token', content: "Checking " },
        { type: 'token', content: "weather " },
        { type: 'token', content: "API " },
        { type: 'token', content: "for " },
        { type: 'token', content: "San " },
        { type: 'token', content: "Francisco." },
        { type: 'token', content: "</thinking>" },
        { type: 'token', content: "\nI will verify this.\n" },
        { type: 'token', content: "<reasoning>" },
        { type: 'token', content: "Verifying data integrity... " },
        { type: 'token', content: "Data looks good." },
        { type: 'token', content: "</reasoning>" },

        // VisionAnalyze - VQA mode
        {
            type: 'tool_call',
            name: 'vision_analyze',
            id: 'call_vqa_1',
            args: {
                mode: 1,
                image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=2000&auto=format&fit=crop',
                question: 'What is the weather like?'
            }
        },
        {
            type: 'tool_result',
            id: 'call_vqa_1',
            result: {
                status: 'ok',
                data: {
                    answer: 'It looks like a clear, sunny day with calm water.'
                },
                message: 'Vision VQA analysis completed.'
            }
        },

        // VisionAnalyze - Grounding mode
        {
            type: 'tool_call',
            name: 'vision_analyze',
            id: 'call_ground_1',
            args: {
                mode: 2,
                image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=2000&auto=format&fit=crop',
                question: 'Where is the bridge?'
            }
        },
        {
            type: 'tool_result',
            id: 'call_ground_1',
            result: {
                status: 'ok',
                data: {
                    objects: [
                        {
                            label: 'bridge',
                            pixel_x: 900,
                            pixel_y: 450,
                            distance: 25.0,
                            angle_deg: 0.0,
                            confidence: 0.98
                        }
                    ],
                    detection_count: 1
                },
                message: "Located the bridge in the scene."
            }
        },

        // TakeAction tool example
        {
            type: 'tool_call',
            name: 'take_action',
            id: 'call_action_1',
            args: {
                action_name: 'Wave'
            }
        },
        {
            type: 'tool_result',
            id: 'call_action_1',
            result: {
                status: 'ok',
                data: {
                    action_name: 'Wave'
                },
                message: "Successfully executed action 'Wave'."
            }
        },
        // ControlNav tool example - Navigation
        {
            type: 'tool_call',
            name: 'control_nav',
            id: 'call_nav_1',
            args: {
                x: 1.5,
                y: -0.5
            }
        },
        // Wait a bit to show progress bar
        { type: 'token', content: "Navigating" },
        { type: 'token', content: "..." },
        {
            type: 'tool_result',
            id: 'call_nav_1',
            result: "✅ Navigating to (x=1.5m forward, y=-0.5m left)"
        },
        // ControlNav tool example - Rotation
        {
            type: 'tool_call',
            name: 'control_nav',
            id: 'call_rot_1',
            args: {
                angle: 90
            }
        },
        {
            type: 'tool_result',
            id: 'call_rot_1',
            result: "✅ Rotated 90° Left"
        },
        { type: 'token', content: "The " },
        { type: 'token', content: "weather " },
        { type: 'token', content: "is " },
        { type: 'token', content: "sunny." },
    ];

    let i = 0;
    const interval = setInterval(() => {
        if (i >= steps.length) {
            clearInterval(interval);
            return;
        }
        broadcastMock(steps[i]);
        i++;
    }, 200); // 200ms delay between chunks
};

// Start mock stream after 5 seconds automatically for testing (or loop it)
setInterval(() => {
    if (wss.clients.size > 0) {
        // Only start if someone is listening and we haven't flooded them recently?
        // For now, let's just expose a way to trigger it? 
        // Or just run it once a client connects?
    }
    // Simple auto-trigger for demo purposes every 10s if clients connected?
    // startMockStream(); 
}, 15000);

// The previous second wss.on('connection') block is now integrated into the first one.
// The setTimeout(startMockStream, 2000); call is removed as it was not part of the requested change.

const PORT = process.env.PORT || 61111;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Server started on port ${PORT}`);
});

