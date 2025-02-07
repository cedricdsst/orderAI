// Global variables
let sessionId = null;
let isWaitingForResponse = false;
let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let recognition = null;
let isListening = false;
let finalTranscript = ""; // Variable pour stocker le résultat final de la dictée
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Variables pour la gestion du TTS
let ttsEnabled = true;              // Activation/désactivation du TTS via le bouton toggle
let currentTtsSource = null;        // Référence à l'audio en cours pour pouvoir l'arrêter

// DOM elements
const chatHistory = document.getElementById("chat-history");
const orderDisplay = document.getElementById("order-display");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Création et ajout du bouton micro
const micButton = document.createElement('button');
micButton.id = 'mic-button';
micButton.innerHTML = '🎤';
micButton.className = 'mic-button';
sendBtn.parentNode.insertBefore(micButton, sendBtn.nextSibling);

// Création et ajout du bouton toggle TTS
const ttsToggleButton = document.createElement('button');
ttsToggleButton.id = 'tts-toggle-button';
ttsToggleButton.innerHTML = 'TTS ON';  // Par défaut, le TTS est activé
ttsToggleButton.className = 'tts-toggle-button';
micButton.parentNode.insertBefore(ttsToggleButton, micButton.nextSibling);

// Ajout des styles pour les boutons micro et TTS
const style = document.createElement('style');
style.textContent = `
    .mic-button, .tts-toggle-button {
        padding: 10px;
        margin-left: 10px;
        border-radius: 50%;
        border: none;
        background: #f0f0f0;
        cursor: pointer;
        transition: all 0.3s;
    }
    
    .mic-button.listening {
        background: #ff4444;
        color: white;
    }
    
    .tts-toggle-button.off {
        background: #cccccc;
        color: #666666;
    }
`;
document.head.appendChild(style);

// -------------------------------
// Speech Recognition Setup
// -------------------------------
function setupSpeechRecognition() {
  console.log('Setting up speech recognition...');
  
  if ('webkitSpeechRecognition' in window) {
      console.log('Speech recognition is supported');
      recognition = new webkitSpeechRecognition();
      
      // Configuration de la reconnaissance
      recognition.continuous = false;
      recognition.interimResults = true;  // Permet d'afficher les résultats intérimaires (non utilisés ici)
      recognition.lang = 'fr-FR';
      
      console.log('Speech recognition configured:', {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          lang: recognition.lang
      });

      recognition.onstart = () => {
          console.log('Speech recognition started');
          isListening = true;
          micButton.classList.add('listening');
      };

      // Lorsque des résultats sont disponibles, on récupère le transcript final
      recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                  finalTranscript = event.results[i][0].transcript;
                  console.log('Final transcript:', finalTranscript);
              }
          }
      };

      recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          addMessageToChat(`Speech recognition error: ${event.error}`, "system");
          stopListening();
      };

      recognition.onend = () => {
          console.log('Speech recognition ended');
          stopListening();
          // Si un résultat final a été obtenu, envoyer le message automatiquement
          if (finalTranscript.trim() !== "") {
              sendMessage(finalTranscript);
              finalTranscript = "";
          }
      };

      // Demande d'autorisation pour accéder au microphone
      navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function(stream) {
              console.log('Microphone permission granted');
              stream.getTracks().forEach(track => track.stop());
          })
          .catch(function(err) {
              console.error('Error accessing microphone:', err);
              addMessageToChat("Please allow microphone access to use speech recognition", "system");
              micButton.style.display = 'none';
          });

  } else {
      console.error('Speech recognition not supported in this browser');
      micButton.style.display = 'none';
      addMessageToChat("Speech recognition is not supported in your browser", "system");
  }
}

function startListening() {
  console.log('Starting listening...');
  // Arrêter le TTS en cours avant de démarrer la dictée
  stopCurrentTTS();
  if (recognition && !isListening) {
      try {
          recognition.start();
          isListening = true;
          micButton.classList.add('listening');
          console.log('Recognition started successfully');
      } catch (error) {
          console.error('Error starting recognition:', error);
          addMessageToChat("Error starting speech recognition. Please try again.", "system");
      }
  } else {
      console.log('Cannot start listening:', {
          recognitionExists: !!recognition,
          isListening: isListening
      });
  }
}

function stopListening() {
  console.log('Stopping listening...');
  if (recognition && isListening) {
      try {
          recognition.stop();
          console.log('Recognition stopped successfully');
      } catch (error) {
          console.error('Error stopping recognition:', error);
      }
  }
  isListening = false;
  micButton.classList.remove('listening');
}

// -------------------------------
// Audio Playback Functions
// -------------------------------
async function playAudioFromBase64(base64Audio) {
    if (!base64Audio || !ttsEnabled) return;
    
    try {
        // Conversion du base64 en ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Décodage et lecture de l'audio
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        // Conserver la référence du TTS en cours
        currentTtsSource = source;

        return new Promise((resolve) => {
            source.onended = () => {
                currentTtsSource = null;
                resolve();
            };
        });
    } catch (error) {
        console.error('Audio playback error:', error);
    }
}

// Fonction pour arrêter le TTS en cours
function stopCurrentTTS() {
    if (currentTtsSource) {
        try {
            currentTtsSource.stop();
        } catch (error) {
            console.error('Error stopping current TTS:', error);
        }
        currentTtsSource = null;
    }
}

// -------------------------------
// WebSocket functions
// -------------------------------
function connectWebSocket(sessionId) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log("WebSocket already connected");
        return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/${sessionId}`;

    console.log("Connecting to WebSocket:", wsUrl);
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts = 0;
        addMessageToChat("Connected to server", "system");
    };

    websocket.onmessage = (event) => {
        try {
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
                waitForDialogAndStop();
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };

    websocket.onclose = (event) => {
        console.log("WebSocket disconnected, code:", event.code);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`Attempting to reconnect in ${timeout/1000} seconds...`);
            setTimeout(() => {
                reconnectAttempts++;
                connectWebSocket(sessionId);
            }, timeout);
        } else {
            addMessageToChat("Connection lost. Please refresh the page.", "system");
        }
    };

    websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        addMessageToChat("Connection error. Trying to reconnect...", "system");
    };

    const pingInterval = setInterval(() => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send("ping");
        } else if (websocket && websocket.readyState === WebSocket.CLOSED) {
            clearInterval(pingInterval);
        }
    }, 30000);
}

function closeWebSocket() {
    return new Promise((resolve) => {
        if (websocket) {
            websocket.onclose = () => {
                websocket = null;
                resolve();
            };
            websocket.close();
        } else {
            resolve();
        }
    });
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

    const total = order.items.reduce((sum, item) => sum + item.total_price, 0);
    const totalDiv = document.createElement("div");
    totalDiv.className = "order-total";
    totalDiv.innerHTML = `<strong>Total: $${total.toFixed(2)}</strong>`;
    orderDisplay.appendChild(totalDiv);
}

function setWaitingState(waiting) {
    isWaitingForResponse = waiting;
    sendBtn.disabled = waiting;
    sendBtn.textContent = waiting ? "Waiting..." : "Send";
}

// -------------------------------
// Session management functions
// -------------------------------
async function startSession() {
    try {
        await closeWebSocket();
        
        const response = await fetch("/start/", { method: "POST" });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        sessionId = data.session_id;

        connectWebSocket(sessionId);

        chatHistory.innerHTML = '<p class="system-message">Session started! Ask me anything about the menu.</p>';
        orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    } catch (error) {
        console.error("Failed to start session:", error);
        addMessageToChat("Failed to start session. Please refresh the page.", "system");
    }
}

async function stopSession() {
    if (!sessionId) return;

    try {
        const response = await fetch("/end/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await closeWebSocket();

        sessionId = null;
        addMessageToChat("Session ended. Thank you!", "system");
        orderDisplay.innerHTML = '<p class="empty-order">No items in order</p>';

        userInput.disabled = true;
        sendBtn.disabled = true;
    } catch (error) {
        console.error("Failed to end session:", error);
        addMessageToChat("Failed to end session.", "system");
    }
}

function waitForDialogAndStop() {
    const maxWaitTime = 3000;
    const checkInterval = 100;
    let waited = 0;
    
    const interval = setInterval(() => {
        if (!isWaitingForResponse || waited >= maxWaitTime) {
            clearInterval(interval);
            
            stopSession().then(() => {
                setTimeout(() => {
                    startSession();
                }, 3000);
            });
        } else {
            waited += checkInterval;
        }
    }, checkInterval);
}

// -------------------------------
// Chat message function
// -------------------------------
// La fonction sendMessage accepte un paramètre optionnel.
// Si fourni, le message sera directement envoyé sans passer par le champ de saisie.
async function sendMessage(optionalText) {
    const message = optionalText !== undefined ? optionalText.trim() : userInput.value.trim();
    if (!message) return;

    try {
        if (!sessionId) {
            await startSession();
        }

        addMessageToChat(message, "user");
        // Si le message a été envoyé automatiquement via la reconnaissance, le champ n'est pas utilisé
        if (optionalText === undefined) {
            userInput.value = "";
        }
        setWaitingState(true);

        const response = await fetch("/send/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, message }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Afficher la réponse textuelle et jouer le TTS simultanément (si activé)
        addMessageToChat(data.ai_response, "bot");
        if (data.audio_data) {
            playAudioFromBase64(data.audio_data);
        }

        if (data.order) {
            displayOrder(data.order);
        }

        // Si le WebSocket n'est pas connecté, tenter de se reconnecter
        if (!websocket || websocket.readyState !== WebSocket.OPEN) {
            connectWebSocket(sessionId);
        }
    } catch (error) {
        console.error("Error sending message:", error);
        addMessageToChat("Failed to send message. Please try again.", "system");
        
        // En cas d'erreur 422, redémarrer la session
        if (error.message.includes("422")) {
            sessionId = null;
            await startSession();
        }
    } finally {
        setWaitingState(false);
        userInput.focus();
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

// Évènements pour le bouton micro :
// - Au "mousedown" : arrêter le TTS en cours et démarrer la dictée.
// - Au "mouseup"/"touchend" : arrêter la dictée (ce qui déclenche onend et l'envoi du message).
micButton.addEventListener('mousedown', (e) => {
  e.preventDefault();
  console.log('Mic button pressed');
  stopCurrentTTS();
  startListening();
});

micButton.addEventListener('mouseup', (e) => {
  e.preventDefault();
  console.log('Mic button released');
  stopListening();
});

micButton.addEventListener('mouseleave', (e) => {
  e.preventDefault();
  console.log('Mouse left mic button');
  if (isListening) {
      stopListening();
  }
});

micButton.addEventListener('touchstart', (e) => {
  e.preventDefault();
  console.log('Mic button touched');
  stopCurrentTTS();
  startListening();
});

micButton.addEventListener('touchend', (e) => {
  e.preventDefault();
  console.log('Mic button touch ended');
  stopListening();
});

// Évènement pour le bouton toggle TTS
ttsToggleButton.addEventListener('click', (e) => {
  e.preventDefault();
  ttsEnabled = !ttsEnabled;
  if (ttsEnabled) {
      ttsToggleButton.innerHTML = 'TTS ON';
      ttsToggleButton.classList.remove('off');
      console.log("TTS activé");
  } else {
      ttsToggleButton.innerHTML = 'TTS OFF';
      ttsToggleButton.classList.add('off');
      console.log("TTS désactivé");
      // Arrêter immédiatement tout TTS en cours
      stopCurrentTTS();
  }
});

// Rendre les boutons interactifs
micButton.style.cursor = 'pointer';
micButton.title = 'Hold to speak';
ttsToggleButton.style.cursor = 'pointer';
ttsToggleButton.title = 'Toggle TTS ON/OFF';

// Initialiser la reconnaissance vocale et démarrer la session au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    setupSpeechRecognition();
    startSession();
});
