<?php

declare(strict_types=1);

return [
    'db_path' => getenv('BITLOCKER_DB_PATH') ?: __DIR__ . '/../data/app.db',
    'app_name' => 'BitLocker Key Vault',
    'session_name' => 'bitlocker_session',
];
