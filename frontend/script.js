// Global variables
let sessionId = null;
let isWaitingForResponse = false;
let websocket = null;

// DOM elements
const chatHistory = document.getElementById("chat-history");
const orderDisplay = document.getElementById("order-display");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// -------------------------------
// WebSocket functions
// -------------------------------
function connectWebSocket(sessionId) {
  // Build the WebSocket URL based on the current protocol and host
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = window.location.host;
  const wsUrl = `${wsProtocol}//${wsHost}/ws/${sessionId}`;

  websocket = new WebSocket(wsUrl);

  websocket.onopen = () => {
    console.log("WebSocket connected");
  };

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("WebSocket message:", data);

    if (data.type === "order_update") {
      console.log("Order update:", data.data);
      displayOrder(data.data);
    } else if (data.type === "past_order") {
      const completionDiv = document.createElement("div");
      completionDiv.className = "completion-message";
      completionDiv.textContent = `Order completed! Your order number is: ${data.order_number}`;
      orderDisplay.appendChild(completionDiv);

      // Wait for any pending dialog response (up to 3 seconds)
      // then wait an additional 3 seconds before stopping and restarting.
      waitForDialogAndStop();
    }
  };

  websocket.onclose = () => {
    console.log("WebSocket disconnected");
  };

  // Keep the connection alive
  setInterval(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send("ping");
    }
  }, 30000);
}

function closeWebSocket() {
  if (websocket) {
    websocket.close();
    websocket = null;
  }
}

// -------------------------------
// UI update functions
// -------------------------------
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

  orderDisplay.innerHTML = order.items
    .map((item) => {
      const itemDetails =
        item.quantity > 1
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
    })
    .join("");

  // Calculate and display total
  const total = order.items.reduce((sum, item) => sum + item.total_price, 0);
  const totalDiv = document.createElement("div");
  totalDiv.className = "order-total";
  totalDiv.innerHTML = `<strong>Total: $${total.toFixed(2)}</strong>`;
  orderDisplay.appendChild(totalDiv);
}

function setWaitingState(waiting) {
    isWaitingForResponse = waiting;
    sendBtn.disabled = waiting; // Only disable the button
    // Do not disable userInput so that it remains active
    sendBtn.textContent = waiting ? "Waiting..." : "Send";
  }

// -------------------------------
// Session management functions
// -------------------------------
async function startSession() {
  try {
    // Start the session via the API
    const response = await fetch("/start/", { method: "POST" });
    const data = await response.json();
    sessionId = data.session_id;

    // Connect to the WebSocket
    connectWebSocket(sessionId);

    // Update UI
    chatHistory.innerHTML =
      '<p class="system-message">Session started! Ask me anything about the menu.</p>';
    orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

    // Enable input controls and focus the input
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  } catch (error) {
    addMessageToChat("Failed to start session.", "system");
  }
}

async function stopSession() {
  if (!sessionId) return;

  try {
    // End the session via the API
    await fetch("/end/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });

    closeWebSocket();

    sessionId = null;
    addMessageToChat("Session ended. Thank you!", "system");
    orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

    userInput.disabled = true;
    sendBtn.disabled = true;
  } catch (error) {
    addMessageToChat("Failed to end session.", "system");
  }
}

// When a "past_order" message is received, wait (up to 3 seconds)
// for any pending dialog response to finish, then wait an additional
// 3 seconds before stopping the session and starting a new one.
function waitForDialogAndStop() {
  const maxWaitTime = 3000; // maximum wait time for pending dialog response
  const checkInterval = 100; // check every 100ms
  let waited = 0;
  const interval = setInterval(() => {
    if (!isWaitingForResponse || waited >= maxWaitTime) {
      clearInterval(interval);
      // Add an additional 3-second timeout before stopping and restarting
      setTimeout(() => {
        stopSession().then(() => {
          startSession();
        });
      }, 3000);
    } else {
      waited += checkInterval;
    }
  }, checkInterval);
}

// -------------------------------
// Chat message function
// -------------------------------
async function sendMessage() {
    if (!userInput.value.trim()) return;
  
    if (!sessionId) {
      await startSession();
    }
  
    const message = userInput.value.trim();
    addMessageToChat(message, "user");
    userInput.value = "";
    setWaitingState(true);
  
    try {
      const response = await fetch("/send/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message }),
      });
      const data = await response.json();
  
      // Display the AI response
      addMessageToChat(data.ai_response, "bot");
  
      // Display order if provided
      if (data.order) {
        displayOrder(data.order);
      }
    } catch (error) {
      addMessageToChat("Failed to send message. Please try again.", "system");
    } finally {
      setWaitingState(false);
      userInput.focus(); // Keep the input focused for immediate typing
    }
  }
  

// -------------------------------
// Event Listeners
// -------------------------------
userInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && !isWaitingForResponse) {
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);
