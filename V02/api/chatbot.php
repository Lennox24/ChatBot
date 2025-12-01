<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Configuración
require_once 'config.php';

// Incluir librerías de Google
require_once 'vendor/autoload.php';

// Respuesta por defecto
 $response = [
    'success' => false,
    'response' => 'Lo siento, no puedo procesar tu solicitud en este momento.',
    'corrections' => [],
    'suggestions' => []
];

try {
    // Obtener datos de la solicitud
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data || !isset($data['message']) || !isset($data['sessionId'])) {
        throw new Exception('Datos de entrada inválidos');
    }
    
    $message = $data['message'];
    $sessionId = $data['sessionId'];
    
    // Registrar la consulta en Google Sheets
    logQueryToGoogleSheets($sessionId, $message);
    
    // Corregir el mensaje si es necesario
    $corrections = correctMessage($message);
    $correctedMessage = $corrections['correctedText'];
    
    // Buscar información relevante en Google Drive
    $driveInfo = searchInGoogleDrive($correctedMessage);
    
    // Generar respuesta usando OpenRouter
    $botResponse = generateResponseWithOpenRouter($correctedMessage, $driveInfo);
    
    // Obtener sugerencias basadas en la consulta
    $suggestions = getSuggestions($correctedMessage);
    
    // Preparar respuesta exitosa
    $response = [
        'success' => true,
        'response' => $botResponse,
        'corrections' => $corrections['corrections'],
        'suggestions' => $suggestions
    ];
    
} catch (Exception $e) {
    error_log('Error en chatbot.php: ' . $e->getMessage());
    $response['response'] = 'Ha ocurrido un error al procesar tu solicitud: ' . $e->getMessage();
}

// Devolver respuesta
echo json_encode($response);

// Función para registrar consultas en Google Sheets
function logQueryToGoogleSheets($sessionId, $message) {
    try {
        $client = new Google_Client();
        $client->setApplicationName('IESTP Chatbot');
        $client->setScopes([Google_Service_Sheets::SPREADSHEETS]);
        $client->setAuthConfig(GOOGLE_AUTH_CONFIG);
        $client->setAccessType('offline');
        
        $service = new Google_Service_Sheets($client);
        $spreadsheetId = GOOGLE_SHEETS_ID;
        $range = 'Consultas!A:C'; // Hoja "Consultas", columnas A, B, C
        
        $values = [
            [
                date('Y-m-d H:i:s'), // Fecha y hora
                $sessionId, // ID de sesión
                $message // Mensaje del usuario
            ]
        ];
        
        $body = new Google_Service_Sheets_ValueRange([
            'values' => $values
        ]);
        
        $params = [
            'valueInputOption' => 'RAW'
        ];
        
        $result = $service->spreadsheets_values->append(
            $spreadsheetId,
            $range,
            $body,
            $params
        );
        
        return true;
    } catch (Exception $e) {
        error_log('Error al registrar en Google Sheets: ' . $e->getMessage());
        return false;
    }
}

// Función para buscar información en Google Drive
function searchInGoogleDrive($message) {
    try {
        $client = new Google_Client();
        $client->setApplicationName('IESTP Chatbot');
        $client->setScopes([Google_Service_Drive::DRIVE_READONLY]);
        $client->setAuthConfig(GOOGLE_AUTH_CONFIG);
        $client->setAccessType('offline');
        
        $service = new Google_Service_Drive($client);
        
        // Extraer palabras clave del mensaje
        $keywords = extractKeywords($message);
        
        // Construir consulta de búsqueda
        $query = "name contains '" . implode("' or name contains '", $keywords) . "'";
        
        // Limitar a la carpeta específica si se configura
        if (defined('GOOGLE_DRIVE_FOLDER_ID')) {
            $query .= " and '" . GOOGLE_DRIVE_FOLDER_ID . "' in parents";
        }
        
        // Ejecutar búsqueda
        $results = $service->files->listFiles([
            'q' => $query,
            'pageSize' => 5,
            'fields' => 'files(id, name, mimeType, webViewLink)'
        ]);
        
        $files = [];
        foreach ($results->getFiles() as $file) {
            $files[] = [
                'id' => $file->getId(),
                'name' => $file->getName(),
                'mimeType' => $file->getMimeType(),
                'webViewLink' => $file->getWebViewLink()
            ];
        }
        
        return $files;
    } catch (Exception $e) {
        error_log('Error al buscar en Google Drive: ' . $e->getMessage());
        return [];
    }
}

// Función para generar respuesta con OpenRouter
function generateResponseWithOpenRouter($message, $driveInfo) {
    try {
        // Preparar contexto con información de Google Drive
        $context = '';
        if (!empty($driveInfo)) {
            $context = "Información relevante encontrada en los documentos:\n";
            foreach ($driveInfo as $file) {
                $context .= "- {$file['name']}: {$file['webViewLink']}\n";
            }
            $context .= "\n";
        }
        
        // Preparar el prompt para OpenRouter
        $prompt = "Eres un asistente virtual del IESTP Juan Velasco Alvarado. Responde a la siguiente consulta de un estudiante de manera clara y concisa. ";
        $prompt .= "Proporciona información precisa sobre trámites académicos y administrativos. ";
        $prompt .= "Si tienes información relevante en los documentos proporcionados, úsala para enriquecer tu respuesta. ";
        $prompt .= "Si no tienes suficiente información, indica amablemente que necesitas más detalles o que el estudiante debe contactar directamente con la oficina correspondiente.\n\n";
        $prompt .= $context;
        $prompt .= "Consulta del estudiante: " . $message . "\n\n";
        $prompt .= "Respuesta:";
        
        // Realizar llamada a la API de OpenRouter
        $ch = curl_init(OPENROUTER_API_URL);
        
        $payload = json_encode([
            'model' => OPENROUTER_MODEL,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un asistente especializado en trámites académicos del IESTP Juan Velasco Alvarado.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ]
        ]);
        
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . OPENROUTER_API_KEY,
            'HTTP-Referer: ' . BASE_URL,
            'X-Title: IESTP Juan Velasco Alvarado Chatbot'
        ]);
        
        $response = curl_exec($ch);
        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpcode !== 200) {
            throw new Exception('Error en la llamada a OpenRouter: ' . $httpcode);
        }
        
        $data = json_decode($response, true);
        
        if (!isset($data['choices'][0]['message']['content'])) {
            throw new Exception('Respuesta inválida de OpenRouter');
        }
        
        return $data['choices'][0]['message']['content'];
    } catch (Exception $e) {
        error_log('Error al generar respuesta con OpenRouter: ' . $e->getMessage());
        return 'Lo siento, no puedo procesar tu consulta en este momento. Por favor, inténtalo más tarde o contacta directamente con la oficina correspondiente.';
    }
}

// Función para corregir el mensaje (simplificada)
function correctMessage($message) {
    // Implementación simplificada de corrección
    // En un entorno real, aquí se podría usar una librería de corrección ortográfica
    return [
        'correctedText' => $message,
        'corrections' => []
    ];
}

// Función para extraer palabras clave
function extractKeywords($message) {
    // Palabras comunes relacionadas con trámites
    $commonWords = ['el', 'la', 'los', 'las', 'de', 'del', 'y', 'o', 'pero', 'mas', 'ni', 'que', 'como', 'cuando', 'donde', 'por', 'para', 'una', 'unos', 'unas', 'un', 'en', 'con', 'sin', 'sobre', 'entre', 'hacia', 'hasta', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'me', 'te', 'le', 'nos', 'os', 'les', 'se', 'lo', 'la', 'los', 'las'];
    
    // Convertir a minúsculas y dividir en palabras
    $words = strtolower($message);
    $words = preg_replace('/[^\w\s]/', '', $words);
    $words = explode(' ', $words);
    
    // Filtrar palabras comunes y vacías
    $keywords = array_filter($words, function($word) use ($commonWords) {
        return !empty($word) && !in_array($word, $commonWords);
    });
    
    // Devolver hasta 5 palabras clave más relevantes
    return array_slice($keywords, 0, 5);
}

// Función para obtener sugerencias basadas en la consulta
function getSuggestions($message) {
    $suggestions = [];
    $lowerMessage = strtolower($message);
    
    // Sugerencias basadas en palabras clave
    if (strpos($lowerMessage, 'matrícula') !== false || strpos($lowerMessage, 'matricula') !== false) {
        $suggestions = [
            ['text' => 'Matrícula regular'],
            ['text' => 'Matrícula extemporánea'],
            ['text' => 'Costo de matrícula']
        ];
    } else if (strpos($lowerMessage, 'traslado') !== false) {
        $suggestions = [
            ['text' => 'Traslado interno'],
            ['text' => 'Traslado externo'],
            ['text' => 'Requisitos para traslado']
        ];
    } else if (strpos($lowerMessage, 'reserva') !== false) {
        $suggestions = [
            ['text' => 'Reserva de matrícula'],
            ['text' => 'Costo de reserva'],
            ['text' => 'Procedimiento de reserva']
        ];
    } else if (strpos($lowerMessage, 'reincorporación') !== false || strpos($lowerMessage, 'reincorporacion') !== false) {
        $suggestions = [
            ['text' => 'Reincorporación por repitencia'],
            ['text' => 'Reincorporación por licencia'],
            ['text' => 'Costo de reincorporación']
        ];
    } else if (strpos($lowerMessage, 'cambio de turno') !== false) {
        $suggestions = [
            ['text' => 'Procedimiento de cambio de turno'],
            ['text' => 'Costo de cambio de turno'],
            ['text' => 'Plazos para cambio de turno']
        ];
    } else if (strpos($lowerMessage, 'titulación') !== false || strpos($lowerMessage, 'titulacion') !== false) {
        $suggestions = [
            ['text' => 'Proceso de titulación'],
            ['text' => 'Costo de titulación'],
            ['text' => 'Requisitos para titulación']
        ];
    } else {
        // Sugerencias generales
        $suggestions = [
            ['text' => 'Matrícula'],
            ['text' => 'Traslado'],
            ['text' => 'Reserva de matrícula'],
            ['text' => 'Reincorporación'],
            ['text' => 'Cambio de turno'],
            ['text' => 'Titulación']
        ];
    }
    
    return $suggestions;
}
?>