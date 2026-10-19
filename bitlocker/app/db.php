<?php

declare(strict_types=1);

function get_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }

    return $config;
}

function get_db(): PDO
{
    static $db = null;
    if ($db === null) {
        $config = get_config();
        $db = new PDO('sqlite:' . $config['db_path']);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        ensure_bitlocker_schema($db);
    }

    return $db;
}

function ensure_bitlocker_schema(PDO $db): void
{
    $exists = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='bitlocker_keys'");
    if (!$exists || !$exists->fetch()) {
        return;
    }

    $result = $db->query("PRAGMA table_info('bitlocker_keys')");
    if (!$result) {
        return;
    }

    $columns = [];
    foreach ($result as $row) {
        $columns[] = $row['name'];
    }

    if (!in_array('source_file_date', $columns, true)) {
        $db->exec('ALTER TABLE bitlocker_keys ADD COLUMN source_file_date TEXT');
    }
    if (!in_array('deleted_at', $columns, true)) {
        $db->exec('ALTER TABLE bitlocker_keys ADD COLUMN deleted_at TEXT');
    }
}
