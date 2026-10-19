<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';

function start_app_session(): void
{
    $config = get_config();
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name($config['session_name']);
        session_start();
    }
}

function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: /?action=login');
        exit;
    }
}

function is_logged_in(): bool
{
    return !empty($_SESSION['user']);
}

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function login_user(string $username, string $password): bool
{
    $db = get_db();
    $stmt = $db->prepare('SELECT id, username, password_hash, role FROM users WHERE username = :username');
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return false;
    }

    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
    ];

    return true;
}

function logout_user(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}
