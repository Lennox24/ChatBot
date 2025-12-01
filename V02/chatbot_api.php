<?php
// back-end/chatbot_api.php
require_once 'vendor/autoload.php';
require_once 'config.php';
require_once 'google_auth.php';
require_once 'google_drive_service.php';
require_once 'google_sheets_service.php';
require_once 'openrouter_service.php';

session_start();

header('Content-Type: application/json');

// Iniciar sesión si no está iniciada
if (!isset($_SESSION['access_token'])) {
    // Para este ejemplo, usaremos un token de acceso predefinido
    // En producción, deberías implementar un flujo de OAuth completo
    $_SESSION['access_token'] = array(
        'access_token' => 'YOUR_ACCESS_TOKEN',
        'refresh_token' => 'YOUR_REFRESH_TOKEN',
        'expires_in' => 3600,
        'created' => time()
    );
}

try {
    // Obtener la consulta del usuario
    $input = json_decode(file_get_contents('php://input'), true);
    $query = $input['query'] ?? '';
    
    if (empty($query)) {
        echo json_encode(['response' => 'Por favor, ingresa una consulta.']);
        exit;
    }
    
    // Inicializar servicios
    $driveService = new GoogleDriveService();
    $sheetsService = new GoogleSheetsService();
    $openRouterService = new OpenRouterService();
    
    // Buscar archivos relevantes en Google Drive
    $files = $driveService->searchFiles($query, GOOGLE_DRIVE_FOLDER_ID);
    
    $context = '';
    foreach ($files as $file) {
        if ($file->getMimeType() === 'application/pdf') {
            // Extraer contenido del PDF
            $pdfContent = $driveService->getFileContent($file->getId());
            $context .= "Contenido del documento '{$file->getName()}':\n" . substr($pdfContent, 0, 2000) . "\n\n";
        } else if ($file->getMimeType() === 'application/vnd.google-apps.spreadsheet') {
            // Para Sheets, podrías leer el contenido
            $context .= "Hoja de cálculo relevante: " . $file->getName() . "\n";
        }
    }
    
    // Generar respuesta usando OpenRouter
    $response = $openRouterService->generateResponse($query, $context);
    
    // Registrar la consulta en Google Sheets
    $sheetsService->logQuery($query, $response);
    
    // Devolver la respuesta
    echo json_encode(['response' => $response]);
    
} catch (Exception $e) {
    // Manejar errores
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}


// Sistema de caché para respuestas frecuentes:

function getCachedResponse($query) {
    $cacheFile = 'cache/' . md5(strtolower($query)) . '.txt';
    
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 86400) { // 24 horas
        return file_get_contents($cacheFile);
    }
    
    return false;
}

function cacheResponse($query, $response) {
    $cacheFile = 'cache/' . md5(strtolower($query)) . '.txt';
    file_put_contents($cacheFile, $response);
}


// Sistema de búsqueda más sofisticado que considere sinónimos y términos relacionados:

function expandQuery($query) {
    $synonyms = array(
        'matrícula' => ['matricula', 'inscripción', 'inscripcion'],
        'traslado' => ['cambio', 'transferencia'],
        'reserva' => ['reservar', 'guardar'],
        // ... más sinónimos
    );
    
    $expandedQuery = $query;
    foreach ($synonyms as $term => $synonymList) {
        if (stripos($query, $term) !== false) {
            foreach ($synonymList as $synonym) {
                $expandedQuery .= ' OR ' . $synonym;
            }
        }
    }
    
    return $expandedQuery;
}
?>