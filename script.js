document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    const chatbotContainer = document.getElementById('chatbotContainer');
    const chatbotHeader = document.getElementById('chatbotHeader');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotSend = document.getElementById('chatbotSend');
    const chatbotSuggestions = document.getElementById('chatbotSuggestions');
    const minimizeChatbot = document.getElementById('minimizeChatbot');
    const closeChatbot = document.getElementById('closeChatbot');
    const newMessageBadge = document.getElementById('newMessageBadge');
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notificationTitle');
    const notificationMessage = document.getElementById('notificationMessage');

    // Estado del chatbot
    let isMinimized = false;
    let isHidden = false;
    let unreadMessages = 0;
    let isProcessing = false;

    // --- LÓGICA DE ARRASTRE UNIFICADA Y FLUIDA ---
    let isDragging = false;
    let dragStartTime = 0;
    const dragThreshold = 5; // Umbral para diferenciar clic de arrastre

    let elementX = 0, elementY = 0; // Posición del elemento
    let initialX = 0, initialY = 0; // Posición inicial del ratón/touch

    function constrainToWindow(element, x, y) {
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
    }

    function startDrag(e) {
        // Solo se puede arrastrar por el header
        if (!e.target.closest('.chatbot-header')) return;

        isDragging = false;
        dragStartTime = Date.now();
        
        const rect = chatbotContainer.getBoundingClientRect();
        elementX = rect.left;
        elementY = rect.top;

        if (e.type === "mousedown") {
            initialX = e.clientX - elementX;
            initialY = e.clientY - elementY;
        } else if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - elementX;
            initialY = e.touches[0].clientY - elementY;
        }
        
        chatbotContainer.style.transition = 'none';
    }

    function drag(e) {
        if (dragStartTime === 0) return;

        let clientX, clientY;
        if (e.type === "mousemove") {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.type === "touchmove") {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        const deltaX = clientX - initialX - elementX;
        const deltaY = clientY - initialY - elementY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > dragThreshold) {
            isDragging = true;
            e.preventDefault();
        }

        if (isDragging) {
            let newX = clientX - initialX;
            let newY = clientY - initialY;

            const constrainedPos = constrainToWindow(chatbotContainer, newX, newY);
            
            chatbotContainer.style.left = `${constrainedPos.x}px`;
            chatbotContainer.style.top = `${constrainedPos.y}px`;
            chatbotContainer.style.right = 'auto';
            chatbotContainer.style.bottom = 'auto';
        }
    }

    function endDrag(e) {
        if (dragStartTime === 0) return;
        
        const dragEndTime = Date.now();
        const dragDuration = dragEndTime - dragStartTime;

        chatbotContainer.style.transition = '';

        // Lógica de Clic vs. Arrastre
        if (!isDragging && dragDuration < 200) {
            // Si fue un clic rápido y no un arrastre...
            if (isMinimized) {
                // ...y el chatbot está minimizado, restaurarlo.
                restoreChatbot();
            }
        }
        
        // Resetear estado de arrastre
        isDragging = false;
        dragStartTime = 0;
    }

    function restoreChatbot() {
        chatbotContainer.classList.remove('minimized', 'hidden');
        isMinimized = false;
        isHidden = false;
        unreadMessages = 0;
        if (newMessageBadge) newMessageBadge.style.display = 'none';
    }

    // Asignar eventos de arrastre al documento
    document.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('touchend', endDrag);

    // --- LÓGICA DE PROCESAMIENTO DE MENSAJES Y RESPUESTAS ---

    // Función de distancia de Levenshtein para comparar palabras
    function levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Función para encontrar la mejor coincidencia
    function findBestMatch(word, dictionary) {
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const [correct, variations] of Object.entries(dictionary)) {
            for (const variation of variations) {
                const distance = levenshteinDistance(word.toLowerCase(), variation.toLowerCase());
                if (distance < bestDistance && distance <= Math.max(1, Math.floor(word.length * 0.3))) {
                    bestDistance = distance;
                    bestMatch = correct;
                }
            }
        }

        return bestMatch;
    }

    // Sistema de corrección mejorado y más preciso
    function advancedCorrection(text) {
        const originalText = text;
        let correctedText = text;
        const corrections = [];

        // Diccionario más preciso con menos variaciones para evitar errores
        const dictionary = {
            'matrícula': ['matricula'], 'traslado': ['traslado'], 'reserva': ['reserva'], 'reincorporación': ['reincorporacion'],
            'titulación': ['titulacion'], 'banco': ['banco'], 'nación': ['nacion'], 'cuenta': ['cuenta'], 'voucher': ['voucher'],
            'tesorería': ['tesoreria'], 'secretaría': ['secretaria'], 'académica': ['academica'], 'dirección': ['direccion'],
            'costo': ['costo'], 'procedimiento': ['procedimiento'], 'requisitos': ['requisitos'], 'documento': ['documento'],
            'pago': ['pago'], 'depósito': ['deposito'], 'créditos': ['creditos'], 'semestre': ['semestre'], 'módulo': ['modulo'],
            'unidades didácticas': ['unidades didacticas'], 'experiencias formativas': ['experiencias formativas'],
            'constancia': ['constancia'], 'certificado': ['certificado'], 'resolución': ['resolucion'], 'directoral': ['directoral'],
            'expedito': ['expedito'], 'bachiller': ['bachiller'], 'título': ['titulo'], 'técnico': ['tecnico'], 'grado': ['grado'],
            'egresado': ['egresado'], 'convalidación': ['convalidacion'], 'licencia': ['licencia'], 'repitencia': ['repitencia'],
            'exonerado': ['exonerado'], 'deportista': ['deportista'], 'artista': ['artista'], 'calificado': ['calificado'],
            'instituto': ['instituto'], 'educación': ['educacion'], 'superior': ['superior'], 'tecnológico': ['tecnologico'],
            'público': ['publico'], 'juan': ['juan'], 'velasco': ['velasco'], 'alvarado': ['alvarado'], 'villa': ['villa'],
            'maría': ['maria'], 'triunfo': ['triunfo'], 'lima': ['lima'], 'perú': ['peru']
        };

        // Solo corregir palabras que estén claramente mal escritas
        const words = correctedText.split(/\s+/);

        for (let i = 0; i < words.length; i++) {
            const originalWord = words[i].toLowerCase().replace(/[.,!?;:]/g, '');

            // No corregir palabras cortas o que ya parezcan correctas
            if (originalWord.length < 3 || originalWord.length > 15) continue;

            const bestMatch = findBestMatch(originalWord, dictionary);

            // Solo corregir si la coincidencia es muy buena
            if (bestMatch && bestMatch !== originalWord) {
                const distance = levenshteinDistance(originalWord, bestMatch);
                // Solo corregir si el error es pequeño (máximo 1 o 2 caracteres)
                if (distance <= 2 && distance <= Math.floor(originalWord.length * 0.2)) {
                    corrections.push({
                        original: words[i],
                        corrected: bestMatch
                    });
                    words[i] = words[i].replace(originalWord, bestMatch);
                }
            }
        }

        correctedText = words.join(' ');

        return {
            correctedText,
            corrections
        };
    }

    // Función para mostrar notificaciones
    function showNotification(title, message, type = 'info', duration = 4000) {
        if (notificationTitle && notificationMessage) {
            notificationTitle.textContent = title;
            notificationMessage.textContent = message;

            // Cambiar icono según el tipo
            const icon = notification.querySelector('i');
            icon.className = type === 'success' ? 'fas fa-check-circle' :
                             type === 'error' ? 'fas fa-exclamation-circle' :
                             type === 'warning' ? 'fas fa-exclamation-triangle' :
                             'fas fa-info-circle';

            notification.className = `notification ${type} show`;

            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }
    }

    // Función para añadir mensaje al chatbot
    function addMessage(message, isUser = false, corrections = null) {
        if (!chatbotMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        // Dividir el mensaje en párrafos si contiene saltos de línea
        const paragraphs = message.split('\n');
        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                const p = document.createElement('div');
                p.textContent = paragraph;
                messageBubble.appendChild(p);
            }
        });

        messageDiv.appendChild(messageBubble);

        // Si hay correcciones, mostrarlas
        if (corrections && corrections.length > 0) {
            const correctionNotice = document.createElement('div');
            correctionNotice.className = 'correction-notice';
            correctionNotice.style.marginTop = '5px';
            correctionNotice.style.fontSize = '0.85rem';
            correctionNotice.style.color = '#666';

            let correctionsText = 'He corregido: ';
            corrections.forEach((correction, index) => {
                correctionsText += `"${correction.original}" → "${correction.corrected}"`;
                if (index < corrections.length - 1) {
                    correctionsText += ', ';
                }
            });

            correctionNotice.textContent = correctionsText;
            messageBubble.appendChild(correctionNotice);
        }

        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = 'Justo ahora';
        messageDiv.appendChild(timestamp);

        chatbotMessages.appendChild(messageDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

        // Si está minimizado, mostrar notificación de nuevo mensaje
        if (isMinimized && !isUser) {
            unreadMessages++;
            if (newMessageBadge) {
                newMessageBadge.textContent = unreadMessages > 9 ? '9+' : unreadMessages;
                newMessageBadge.style.display = 'flex';
            }
        }
    }

    // Función para mostrar indicador de escritura
    function showTypingIndicator() {
        if (!chatbotMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';

        for (let i = 0; i < 3; i++) {
            const span = document.createElement('span');
            typingDiv.appendChild(span);
        }

        chatbotMessages.appendChild(typingDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // Función para ocultar indicador de escritura
    function hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Función para procesar el mensaje del usuario
    function processUserMessage(message) {
        // Evitar duplicación de mensajes
        if (isProcessing) return;
        isProcessing = true;
        
        // Corregir el mensaje
        const { correctedText, corrections } = advancedCorrection(message);
        
        // Añadir el mensaje del usuario
        addMessage(correctedText, true);
        
        // Mostrar indicador de escritura
        showTypingIndicator();
        
        // Enviar la consulta al backend
        fetch('back-end/chatbot_api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: correctedText })
        })
        .then(response => response.json())
        .then(data => {
            hideTypingIndicator();
            isProcessing = false;
            
            if (data.error) {
                addMessage('Lo siento, ocurrió un error al procesar tu consulta: ' + data.error, false, corrections);
            } else {
                addMessage(data.response, false, corrections);
            }
        })
        .catch(error => {
            hideTypingIndicator();
            isProcessing = false;
            addMessage('Lo siento, no pude conectar con el servidor. Por favor, intenta más tarde.', false, corrections);
            console.error('Error:', error);
        });
    }

    // Inicializar el chatbot
    function initChatbot() {
        addMessage('¡Hola! Soy el asistente virtual del IESTP Juan Velasco Alvarado. Estoy aquí para ayudarte con información sobre trámites académicos y administrativos. ¿En qué puedo asistirte hoy?', false);
    }

    // Event Listeners para controles del chatbot
    if (minimizeChatbot) {
        minimizeChatbot.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que el clic se propague al header
            chatbotContainer.classList.add('minimized');
            isMinimized = true;
        });
    }

    if (closeChatbot) {
        closeChatbot.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que el clic se propague al header
            chatbotContainer.classList.add('hidden');
            isHidden = true;
        });
    }

    if (chatbotSend) {
        chatbotSend.addEventListener('click', () => {
            const message = chatbotInput.value.trim();
            if (message) {
                processUserMessage(message);
                chatbotInput.value = '';
            }
        });
    }

    if (chatbotInput) {
        chatbotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = chatbotInput.value.trim();
                if (message) {
                    processUserMessage(message);
                    chatbotInput.value = '';
                }
            }
        });
    }

    if (chatbotSuggestions) {
        chatbotSuggestions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suggestion-chip')) {
                const suggestion = e.target.getAttribute('data-message');
                if (suggestion) processUserMessage(suggestion);
            }
        });
    }

    // Inicializar el chatbot
    initChatbot();
});