<?php
// Configuración de la API de OpenRouter
define('OPENROUTER_API_KEY', 'tu_api_key_de_openrouter');
define('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1/chat/completions');
define('OPENROUTER_MODEL', 'gpt-oss-20b');

// Configuración de Google
define('GOOGLE_AUTH_CONFIG', __DIR__ . '/google-credentials.json');
define('GOOGLE_SHEETS_ID', 'id_de_tu_google_sheet');
define('GOOGLE_DRIVE_FOLDER_ID', 'id_de_tu_carpeta_en_google_drive'); // Opcional

// URL base de tu aplicación
define('BASE_URL', 'https://tu-dominio.com');
?>