// -------------------------------
// No domain/port hardcoded! 
// We build the WebSocket URL from window.location.
// -------------------------------

// In this example, we don't even define API_URL or WS_URL at the top.
// We'll just use relative paths ("/start/", "/send/", "/end/", etc.)

let sessionId = null;
let isWaitingForResponse = false;
let websocket = null;

const chatHistory = document.getElementById("chat-history");
const orderDisplay = document.getElementById("order-display");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");

function connectWebSocket(sessionId) {
    // Determine ws:// or wss:// based on the current page protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host; // e.g. "www.chokbar.fr"
    // Construct the full ws URL => "wss://www.chokbar.fr/ws/<sessionId>"
    const wsUrl = `${wsProtocol}//${wsHost}/ws/${sessionId}`;

    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        if (data.type === 'order_update') {
            console.log('Order update:', data.data);
            displayOrder(data.data);

        } else if (data.type === 'past_order') {
            const completionDiv = document.createElement("div");
            completionDiv.className = "completion-message";
            completionDiv.textContent = `Order completed! Your order number is: ${data.order_number}`;
            orderDisplay.appendChild(completionDiv);
        }
    };

    websocket.onclose = () => {
        console.log('WebSocket disconnected');
    };

    // Keep connection alive
    setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send('ping');
        }
    }, 30000);
}

function closeWebSocket() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
}

function addMessageToChat(message, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;
    messageDiv.innerHTML = message;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function displayOrder(order) {
    if (!order || order.items.length === 0) {
        orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';
        return;
    }

    orderDisplay.innerHTML = order.items.map(item => {
        const itemDetails = item.quantity > 1
            ? `${item.name} - $${item.price.toFixed(2)} each, Total: $${item.total_price.toFixed(2)}`
            : `${item.name} - $${item.price.toFixed(2)}`;

        return `
            <div class="order-item">
                <p class="order-item-quantity">${item.quantity}x</p>
                <img src="/static/assets/img/${item.id}.jpg" alt="${item.name}"
                     onerror="this.onerror=null;this.src='/static/assets/img/${item.id}.png'">
                <div class="order-item-details">
                    <div class="order-item-name">${itemDetails}</div>
                    <div class="order-item-instructions">Instructions: ${item.special_instructions}</div>
                </div>
            </div>
        `;
    }).join("");

    // Calculate and display total
    const total = order.items.reduce((sum, item) => sum + item.total_price, 0);
    const totalDiv = document.createElement("div");
    totalDiv.className = "order-total";
    totalDiv.innerHTML = `<strong>Total: $${total.toFixed(2)}</strong>`;
    orderDisplay.appendChild(totalDiv);
}

function setWaitingState(waiting) {
    isWaitingForResponse = waiting;
    sendBtn.disabled = waiting;
    userInput.disabled = waiting;
    if (waiting) {
        sendBtn.textContent = "Waiting...";
    } else {
        sendBtn.textContent = "Send";
    }
}

async function sendMessage() {
    if (!sessionId || isWaitingForResponse || !userInput.value.trim()) return;

    const message = userInput.value.trim();
    addMessageToChat(message, "user");
    userInput.value = "";
    setWaitingState(true);

    try {
        // No domain here -> fetch("/send/")
        const response = await fetch("/send/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, message }),
        });
        const data = await response.json();

        // Add AI response to chat
        addMessageToChat(data.ai_response, "bot");

        // If the server includes an 'order' object in the response, we display it:
        if (data.order) {
            displayOrder(data.order);
        }

    } catch (error) {
        addMessageToChat("Failed to send message. Please try again.", "system");
    } finally {
        setWaitingState(false);
    }
}

startBtn.addEventListener("click", async () => {
    try {
        // Again, no domain -> fetch("/start/")
        const response = await fetch("/start/", { method: "POST" });
        const data = await response.json();
        sessionId = data.session_id;

        // Connect WebSocket after getting session ID
        connectWebSocket(sessionId);

        chatHistory.innerHTML = '<p class="system-message">Session started! Ask me anything about the menu.</p>';
        orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

        // Enable input after successful connection
        userInput.disabled = false;
        sendBtn.disabled = false;
    } catch (error) {
        addMessageToChat("Failed to start session.", "system");
    }
});

stopBtn.addEventListener("click", async () => {
    if (!sessionId) return;

    try {
        // End session
        await fetch("/end/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
        });

        // Close WebSocket connection
        closeWebSocket();

        sessionId = null;
        addMessageToChat("Session ended. Thank you!", "system");
        orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

        // Disable input
        userInput.disabled = true;
        sendBtn.disabled = true;
    } catch (error) {
        addMessageToChat("Failed to end session.", "system");
    }
});

// Handle Enter key press
userInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter" && !isWaitingForResponse) {
        sendMessage();
    }
});

// Handle Send button click
sendBtn.addEventListener("click", sendMessage);

// Initialize input state
userInput.disabled = true;
sendBtn.disabled = true;
