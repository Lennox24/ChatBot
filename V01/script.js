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

        // Simular tiempo de respuesta
        setTimeout(() => {
            hideTypingIndicator();
            isProcessing = false; // Restablecer el estado de procesamiento

            // Procesar la respuesta
            processTramitesResponse(correctedText, corrections);
        }, 1000 + Math.random() * 1000);
    }

    // Función para procesar respuestas sobre trámites
    function processTramitesResponse(message, corrections) {
        const lowerMessage = message.toLowerCase();

        // Respuestas sobre matrícula
        if (lowerMessage.includes('matrícula') || lowerMessage.includes('matricula')) {
            if (lowerMessage.includes('ratificación') || lowerMessage.includes('ratificacion')) {
                addMessage('Para el proceso de ratificación de matrícula:\n\nCosto: S/. 200.00\n\nProcedimiento:\n1. Verifica tu situación académica en la plataforma REGISTRA\n2. Realiza el depósito de S/. 200.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n3. Canjea el voucher en Tesorería para obtener tu RECIBO DE CAJA\n4. Acércate a la oficina de Secretaría Académica con tu RECIBO DE CAJA y una fotografía tamaño carné\n5. Llena el libro de registro de matrícula\n6. Espera 15 días hábiles para que tus datos sean registrados en el sistema REGISTRA\n\nSi obtuviste el primer puesto de tu salón, estás exonerado del pago. Deberás realizar un depósito de S/. 20.00 por concepto de Resolución Directoral por Primeros Puestos.', false, corrections);
            } else if (lowerMessage.includes('extemporánea') || lowerMessage.includes('extemporanea')) {
                addMessage('Para el proceso de ratificación de matrícula extemporánea:\n\nCosto: S/. 260.00\n\nProcedimiento:\n1. Verifica tu situación académica en la plataforma REGISTRA\n2. Realiza el depósito de S/. 260.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n3. Canjea el voucher en Tesorería para obtener tu RECIBO DE CAJA\n4. Acércate a la oficina de Secretaría Académica con tu RECIBO DE CAJA y una fotografía tamaño carné\n5. Llena el libro de registro de matrícula\n6. Espera 15 días hábiles para que tus datos sean registrados en el sistema REGISTRA\n\nLas fechas para matrícula extemporánea son del 31 de marzo al 4 de abril de 2025 para el semestre 2025-I, y del 1 al 5 de septiembre de 2025 para el semestre 2025-II.', false, corrections);
            } else if (lowerMessage.includes('unidad didáctica') || lowerMessage.includes('unidad didactica')) {
                addMessage('Para el proceso de matrícula por unidad didáctica:\n\nCosto: S/. 50.00 por cada unidad didáctica\n\nProcedimiento:\n1. Realiza el depósito de S/. 50.00 por cada unidad didáctica en el Banco de la Nación, Cuenta Corriente N° 0000289051\n2. Canjea el voucher en Tesorería para obtener tu RECIBO DE CAJA\n3. Solicita mediante Formulario Único de Trámite (FUT) la matrícula de las unidades didácticas\n4. Espera la confirmación en la plataforma REGISTRA\n\nLas fechas para matrícula por unidad didáctica son del 3 al 28 de marzo de 2025 para el semestre 2025-I, y del 25 al 29 de agosto de 2025 para el semestre 2025-II.', false, corrections);
            } else {
                addMessage('Para el proceso de matrícula regular:\n\nCosto: S/. 200.00\n\nProcedimiento:\n1. Verifica tu situación académica en la plataforma REGISTRA\n2. Realiza el depósito de S/. 200.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n3. Canjea el voucher en Tesorería para obtener tu RECIBO DE CAJA\n4. Acércate a la oficina de Secretaría Académica con tu RECIBO DE CAJA y una fotografía tamaño carné\n5. Llena el libro de registro de matrícula\n6. Espera 15 días hábiles para que tus datos sean registrados en el sistema REGISTRA\n\nLas fechas para ratificación de matrícula regular son del 3 al 28 de marzo de 2025 para el semestre 2025-I, y del 25 al 29 de agosto de 2025 para el semestre 2025-II.', false, corrections);
            }
        }
        // Respuestas sobre traslado
        else if (lowerMessage.includes('traslado')) {
            if (lowerMessage.includes('interno')) {
                addMessage('Para el proceso de traslado interno (cambio de especialidad):\n\nCosto: S/. 150.00 (solo si la solicitud es aprobada)\n\nProcedimiento:\n1. Presenta el Formulario Único de Trámite en mesa de partes, especificando tu carrera, semestre y turno actual, así como la carrera y turno a donde deseas cambiar\n2. Adjunta copia de DNI, constancia de no adeudar y certificado de estudios o constancia de notas aprobadas del último módulo\n3. Espera la revisión de tu solicitud (25 de marzo de 2025 para 2025-I, 26 de agosto de 2025 para 2025-II)\n4. Si tu solicitud es aprobada, realiza el pago de S/. 150.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n5. Canjea el voucher en Tesorería y presenta tu RECIBO DE CAJA en Secretaría Académica\n\nLas fechas para presentar solicitudes son del 3 al 21 de marzo de 2025 para 2025-I, y del 25 de julio al 22 de agosto de 2025 para 2025-II.', false, corrections);
            } else if (lowerMessage.includes('externo')) {
                addMessage('Para el proceso de traslado externo:\n\nCostos:\n- Constancia de vacante: S/. 20.00\n- Traslado de instituto público: S/. 150.00\n- Traslado de instituto privado: S/. 250.00\n- Matrícula: S/. 200.00\n\nProcedimiento:\n1. Acércate a Secretaría Académica para verificar compatibilidad de planes de estudio y vacantes disponibles\n2. Presenta el Formulario Único de Trámite en mesa de partes solicitando constancia de vacante\n3. Adjunta copia de DNI, recibo de pago de S/. 20.00 y copia de boletas de notas\n4. Espera la revisión de tu solicitud (25 de marzo de 2025 para 2025-I, 26 de agosto de 2025 para 2025-II)\n5. Una vez aprobada, presenta la solicitud de traslado externo con:\n   - Copia de DNI\n   - Constancia de vacante\n   - Certificado de estudios del instituto de procedencia\n   - Certificado de estudios secundarios\n   - Resolución de autorización de traslado\n   - Recibo de pago por traslado externo\n   - Recibo de pago por matrícula\n\nLas fechas para presentar solicitudes son del 3 al 21 de marzo de 2025 para 2025-I, y del 25 de julio al 22 de agosto de 2025 para 2025-II.', false, corrections);
            } else {
                addMessage('Hay dos tipos de traslado: interno y externo. ¿Sobre cuál te gustaría recibir información?', false, corrections);
            }
        }
        // Respuestas sobre reserva de matrícula
        else if (lowerMessage.includes('reserva')) {
            addMessage('Para el proceso de reserva de matrícula:\n\nCosto: S/. 80.00\n\nProcedimiento:\n1. Realiza primero la ratificación de tu matrícula en el semestre que te corresponde\n2. Presenta el Formulario Único de Trámite en mesa de partes indicando el motivo de la reserva\n3. Especifica tu carrera, semestre y turno donde estás matriculado\n4. Adjunta copia de DNI, constancia de no adeudar y recibo de pago de S/. 80.00\n5. Espera la Resolución Directoral Institucional que aprueba tu reserva\n\nPuedes solicitar reserva de matrícula hasta por un período máximo de 2 años. Las fechas para presentar solicitudes son del 3 al 28 de marzo de 2025 para 2025-I, y del 25 al 29 de agosto de 2025 para 2025-II.', false, corrections);
        }
        // Respuestas sobre reincorporación
        else if (lowerMessage.includes('reincorporación') || lowerMessage.includes('reincorporacion')) {
            addMessage('Para el proceso de reincorporación:\n\nCosto: S/. 80.00 (solo si la solicitud es aprobada)\n\nProcedimiento:\n1. Completa el Formulario Único de Trámite en mesa de partes mencionando el motivo de la reincorporación (repitencia, reserva, licencia u otros)\n2. Especifica tu carrera, semestre y turno donde deseas reincorporarte\n3. Adjunta copia de DNI, constancia de no adeudar y última boleta informativa de notas o copia de resolución de reserva\n4. Espera la revisión de tu solicitud (25 de marzo de 2025 para 2025-I, 26 de agosto de 2025 para 2025-II)\n5. Si tu solicitud es aprobada, realiza el pago de S/. 80.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n6. Canjea el voucher en Tesorería y presenta tu RECIBO DE CAJA en Secretaría Académica\n\nLas fechas para presentar solicitudes son del 3 al 21 de marzo de 2025 para 2025-I, y del 25 de julio al 22 de agosto de 2025 para 2025-II.', false, corrections);
        }
        // Respuestas sobre cambio de turno
        else if (lowerMessage.includes('cambio de turno')) {
            addMessage('Para el proceso de cambio de turno:\n\nCosto: S/. 80.00 (solo si la solicitud es aprobada)\n\nProcedimiento:\n1. Presenta el Formulario Único de Trámite en mesa de partes, especificando tu carrera, semestre y turno actual, así como el turno al que deseas cambiar\n2. Adjunta copia de DNI, constancia de no adeudar y documento que sustente el motivo del cambio\n3. Espera la revisión de tu solicitud (25 de marzo de 2025 para 2025-I, 26 de agosto de 2025 para 2025-II)\n4. Si tu solicitud es aprobada, realiza el pago de S/. 80.00 en el Banco de la Nación, Cuenta Corriente N° 0000289051\n5. Canjea el voucher en Tesorería y presenta tu RECIBO DE CAJA en Secretaría Académica\n\nLas fechas para presentar solicitudes son del 3 al 21 de marzo de 2025 para 2025-I, y del 25 de julio al 22 de agosto de 2025 para 2025-II. La aprobación dependerá de la cantidad de vacantes disponibles por salón.', false, corrections);
        }
        // Respuestas sobre titulación
        else if (lowerMessage.includes('titulación') || lowerMessage.includes('titulacion')) {
            addMessage('Para el proceso de titulación:\n\nCostos:\n- Derecho de titulación: S/. 450.00\n- Resolución Directoral de Expedito: S/. 80.00\n\nProcedimiento:\n1. Realiza el pago de S/. 450.00 por derecho de titulación en el Banco de la Nación, Cuenta Corriente N° 0000289051\n2. Canjea el voucher en Tesorería para obtener tu RECIBO DE CAJA\n3. Presenta tu solicitud en Secretaría Académica con los siguientes requisitos:\n   - Copia de DNI\n   - Grado de Bachiller o Título Técnico\n   - Certificados de estudios\n   - Recibo de pago por derecho de titulación\n4. Espera la Resolución Directoral de Expedito (costo adicional: S/. 80.00)\n\nEl proceso completo puede tomar entre 2 a 3 meses dependiendo de la documentación presentada.', false, corrections);
        }
        // Respuestas sobre cuenta bancaria
        else if (lowerMessage.includes('cuenta') || lowerMessage.includes('banco') || lowerMessage.includes('pago') || lowerMessage.includes('depósito') || lowerMessage.includes('deposito')) {
            addMessage('Para realizar los pagos de los trámites, debes depositar en:\n\nBanco de la Nación\nCuenta Corriente N° 0000289051\n\nUna vez realizado el depósito, debes canjear el voucher en la oficina de Tesorería del instituto para obtener tu RECIBO DE CAJA, que será necesario para completar el trámite correspondiente.\n\n¿Necesitas información sobre algún trámite específico?', false, corrections);
        }
        // Respuestas sobre canje de voucher
        else if (lowerMessage.includes('canjear') || lowerMessage.includes('voucher')) {
            addMessage('Para canjear tu voucher de pago:\n\n1. Dirígete a la oficina de Tesorería del IESTP Juan Velasco Alvarado\n2. Presenta el voucher original del depósito realizado en el Banco de la Nación\n3. El personal de Tesorería verificará el pago y te entregará el RECIBO DE CAJA correspondiente\n4. Este RECIBO DE CAJA es el documento que debes presentar en la oficina de Secretaría Académica para completar tu trámite\n\nLa oficina de Tesorería se encuentra en el mismo local del instituto y su horario de atención es de lunes a viernes en horario administrativo.\n\n¿Necesitas información sobre algún otro paso del proceso?', false, corrections);
        }
        // Respuestas sobre requisitos
        else if (lowerMessage.includes('requisitos')) {
            addMessage('Los requisitos varían según el trámite que necesites realizar. Aquí te menciono los más comunes:\n\nPara matrícula:\n- RECIBO DE CAJA por concepto de matrícula\n- Fotografía tamaño carné\n\nPara traslado interno:\n- Copia de DNI\n- Constancia de no adeudar\n- Certificado de estudios o constancia de notas aprobadas\n\nPara traslado externo:\n- Copia de DNI\n- Constancia de vacante\n- Certificado de estudios del instituto de procedencia\n- Certificado de estudios secundarios\n- Resolución de autorización de traslado\n\nPara reserva de matrícula:\n- Copia de DNI\n- Constancia de no adeudar\n- RECIBO DE CAJA por concepto de reserva\n\nPara reincorporación:\n- Copia de DNI\n- Constancia de no adeudar\n- Última boleta informativa de notas o resolución de reserva\n\nPara cambio de turno:\n- Copia de DNI\n- Constancia de no adeudar\n- Documento que sustente el motivo del cambio\n\n¿Necesitas información detallada sobre algún trámite específico?', false, corrections);
        }
        // Respuestas sobre costos
        else if (lowerMessage.includes('costo') || lowerMessage.includes('precio') || lowerMessage.includes('monto')) {
            addMessage('Aquí te presento los costos de los principales trámites:\n\nMatrícula regular: S/. 200.00\nMatrícula extemporánea: S/. 260.00\nMatrícula por unidad didáctica: S/. 50.00 por cada unidad\nReserva de matrícula: S/. 80.00\nReincorporación: S/. 80.00\nCambio de turno: S/. 80.00\nTraslado interno: S/. 150.00\nTraslado externo (instituto público): S/. 150.00\nTraslado externo (instituto privado): S/. 250.00\nConstancia de vacante: S/. 20.00\nDerecho de titulación: S/. 450.00\nResolución Directoral de Expedito: S/. 80.00\n\nTodos los pagos deben realizarse en el Banco de la Nación, Cuenta Corriente N° 0000289051.\n\n¿Necesitas información sobre el procedimiento de algún trámite específico?', false, corrections);
        }
        // Respuestas sobre fechas
        else if (lowerMessage.includes('fechas') || lowerMessage.includes('plazo') || lowerMessage.includes('cuándo') || lowerMessage.includes('cuando')) {
            addMessage('Aquí te presento las fechas importantes para el 2025:\n\nMatrícula regular 2025-I: 3 al 28 de marzo\nMatrícula extemporánea 2025-I: 31 de marzo al 4 de abril\nMatrícula regular 2025-II: 25 al 29 de agosto\nMatrícula extemporánea 2025-II: 1 al 5 de septiembre\n\nSolicitudes de cambio de turno 2025-I: 3 al 21 de marzo\nSolicitudes de cambio de turno 2025-II: 25 de julio al 22 de agosto\n\nSolicitudes de reserva de matrícula 2025-I: 3 al 28 de marzo\nSolicitudes de reserva de matrícula 2025-II: 25 al 29 de agosto\n\nSolicitudes de reincorporación 2025-I: 3 al 21 de marzo\nSolicitudes de reincorporación 2025-II: 25 de julio al 22 de agosto\n\nSolicitudes de traslado 2025-I: 3 al 21 de marzo\nSolicitudes de traslado 2025-II: 25 de julio al 22 de agosto\n\nInicio de clases 2025-I: 7 de abril\nInicio de clases 2025-II: 1 de septiembre\n\n¿Necesitas información sobre algún trámite específico?', false, corrections);
        }
        // Respuestas sobre el instituto
        else if (lowerMessage.includes('instituto') || lowerMessage.includes('iestp') || lowerMessage.includes('juan velasco')) {
            addMessage('El Instituto de Educación Superior Tecnológico Público "Juan Velasco Alvarado" es una institución ubicada en Villa María del Triunfo, Lima, Perú. Ofrece cinco programas académicos técnicos profesionales:\n\n1. Arquitectura de Plataformas y STI\n2. Contabilidad\n3. Enfermería Técnica\n4. Mecatrónica y Mecánica Automotriz\n5. Técnica en Farmacia\n\nActualmente se encuentra en proceso de licenciamiento y es reconocido como líder en educación técnica en Lima Sur.\n\n¿Necesitas información sobre algún trámite específico?', false, corrections);
        }
        // Respuesta para saludos
        else if (lowerMessage.includes('hola') || lowerMessage.includes('buenos') || lowerMessage.includes('saludos')) {
            addMessage('¡Hola! Soy el asistente virtual del IESTP Juan Velasco Alvarado. Estoy aquí para ayudarte con información sobre trámites académicos y administrativos. Puedes consultarme sobre matrícula, traslados, reserva de matrícula, reincorporación, cambio de turno, titulación, entre otros. ¿En qué puedo asistirte hoy?', false, corrections);
        }
        // Respuesta para agradecimientos
        else if (lowerMessage.includes('gracias') || lowerMessage.includes('adiós')) {
            addMessage('¡Gracias por contactarme! Si tienes más preguntas sobre los trámites del IESTP Juan Velasco Alvarado, no dudes en consultarme. ¡Que tengas un excelente día!', false, corrections);
        }
        // Respuesta por defecto
        else {
            addMessage('No he comprendido tu mensaje. ¿Podrías explicarlo de mejor manera? Puedes preguntarme sobre matrícula, traslados, reserva de matrícula, reincorporación, cambio de turno, titulación, costos, fechas o requisitos de los trámites del IESTP Juan Velasco Alvarado.', false, corrections);
        }
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