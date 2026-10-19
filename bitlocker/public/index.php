<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/db.php';
require_once __DIR__ . '/../app/auth.php';
require_once __DIR__ . '/../app/bitlocker.php';
require_once __DIR__ . '/../app/csrf.php';

start_app_session();

$action = $_GET['action'] ?? 'dashboard';
$message = $_SESSION['flash_success'] ?? null;
$error = $_SESSION['flash_error'] ?? null;
$uploadReport = $_SESSION['upload_report'] ?? null;
unset($_SESSION['flash_success'], $_SESSION['flash_error']);
unset($_SESSION['upload_report']);

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function sanitize_return_url(string $url): string
{
    $url = trim($url);
    if ($url === '' || strpos($url, '/') !== 0 || strpos($url, '//') === 0) {
        return '/';
    }
    return $url;
}

function build_return_url(bool $includeAction = false): string
{
    $params = $_GET;
    unset($params['ajax'], $params['return']);
    if (!$includeAction) {
        unset($params['action']);
    }
    $query = http_build_query($params);
    return $query ? '/?' . $query : '/';
}

function render_table_rows(array $rows, int $startIndex = 1, string $returnUrl = '/'): string
{
    if (!$rows) {
        return '<tr><td colspan="9" class="empty">&#128274; Kayıt bulunamadı.</td></tr>';
    }
    $html = '';
    $rowIndex = $startIndex;
    foreach ($rows as $row) {
        $masked = preg_replace('/\d{6}/', '••••••', $row['recovery_key']);
        $html .= '<tr data-id="' . (int)$row['id'] . '" data-raw="' . e($row['raw_text'] ?? '') . '">';
        $html .= '<td><input type="checkbox" form="bulk-delete-form" name="ids[]" value="' . (int)$row['id'] . '"></td>';
        $html .= '<td style="color:var(--ink3);font-size:12px">' . $rowIndex . '</td>';
        $html .= '<td class="name-cell">' . e(to_upper_tr($row['full_name'])) . '</td>';
        $html .= '<td>' . e($row['device_name'] ? to_upper_tr($row['device_name']) : '—') . '</td>';
        $html .= '<td style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--ink3)">' . e($row['identifier'] ?? '—') . '</td>';
        $html .= '<td><div class="key-cell">';
        $html .= '<span class="key-masked" data-key="' . e($row['recovery_key']) . '">' . e($masked) . '</span>';
        $html .= '<button type="button" class="key-toggle-btn" title="Göster/Gizle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>';
        $html .= '<button type="button" class="copy-btn" data-key="' . e($row['recovery_key']) . '" title="Kopyala"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>';
        $html .= '</div></td>';
        $html .= '<td style="font-size:12px;color:var(--ink3)">' . e($row['source_file_date'] ?? '—') . '</td>';
        $html .= '<td style="font-size:12px;color:var(--ink3)">' . e($row['uploaded_at']) . '</td>';
        $html .= '<td><div class="row-actions">';
        $html .= '<a class="btn btn-ghost btn-sm" href="/?action=edit&id=' . (int)$row['id'] . '&return=' . rawurlencode($returnUrl) . '">Düzenle</a>';
        $html .= '<button type="button" class="btn btn-danger btn-sm open-delete-modal" data-id="' . (int)$row['id'] . '" data-name="' . e(to_upper_tr($row['full_name'])) . '" data-return="' . e($returnUrl) . '">Sil</button>';
        $html .= '</div></td>';
        $html .= '</tr>';
        $html .= '<tr class="expand-row" id="expand-' . (int)$row['id'] . '" style="display:none"><td colspan="9"><div class="expand-inner">' . e($row['raw_text'] ?? 'Ham metin yok.') . '</div></td></tr>';
        $rowIndex++;
    }
    return $html;
}

// Pagination removed: show all results on one page.

function render_trash_rows(array $rows, string $returnUrl): string
{
    if (!$rows) {
        return '<tr><td colspan="8" class="empty">&#128465; Çöp kutusu boş.</td></tr>';
    }
    $html = '';
    foreach ($rows as $row) {
        $masked = preg_replace('/\d{6}/', '••••••', $row['recovery_key']);
        $html .= '<tr>';
        $html .= '<td class="name-cell">' . e(to_upper_tr($row['full_name'])) . '</td>';
        $html .= '<td>' . e($row['device_name'] ? to_upper_tr($row['device_name']) : '—') . '</td>';
        $html .= '<td style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--ink3)">' . e($row['identifier'] ?? '—') . '</td>';
        $html .= '<td><div class="key-cell"><span class="key-masked" data-key="' . e($row['recovery_key']) . '">' . e($masked) . '</span>';
        $html .= '<button type="button" class="key-toggle-btn" title="Göster/Gizle"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>';
        $html .= '<button type="button" class="copy-btn" data-key="' . e($row['recovery_key']) . '" title="Kopyala"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button></div></td>';
        $html .= '<td style="font-size:12px;color:var(--ink3)">' . e($row['source_file_date'] ?? '—') . '</td>';
        $html .= '<td style="font-size:12px;color:var(--ink3)">' . e($row['uploaded_at']) . '</td>';
        $html .= '<td style="font-size:12px;color:var(--danger)">' . e($row['deleted_at'] ?? '—') . '</td>';
        $html .= '<td><div class="row-actions">';
        $html .= '<form method="post" action="/?action=restore" style="margin:0">';
        $html .= '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '"><input type="hidden" name="id" value="' . (int)$row['id'] . '"><input type="hidden" name="return_url" value="' . e($returnUrl) . '">';
        $html .= '<button type="submit" class="btn btn-success btn-sm">Geri Al</button></form>';
        $html .= '<form method="post" action="/?action=purge" onsubmit="return confirm(\'Kalıcı silinsin mi?\');" style="margin:0">';
        $html .= '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '"><input type="hidden" name="id" value="' . (int)$row['id'] . '"><input type="hidden" name="return_url" value="' . e($returnUrl) . '">';
        $html .= '<button type="submit" class="btn btn-danger btn-sm">Kalıcı Sil</button></form>';
        $html .= '</div></td></tr>';
    }
    return $html;
}

function purge_old_deleted(PDO $db): void
{
    $db->exec("DELETE FROM bitlocker_keys WHERE deleted_at IS NOT NULL AND deleted_at <= datetime('now', '-180 days')");
}

function to_datetime_local(?string $value): string
{
    if (!$value) {
        return '';
    }
    $value = str_replace(' ', 'T', $value);
    return substr($value, 0, 16);
}

function normalize_datetime_input(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    $value = str_replace('T', ' ', $value);
    if (strlen($value) === 16) {
        $value .= ':00';
    }
    return $value;
}

function get_file_date(array $file): ?string
{
    if (!isset($file['tmp_name']) || $file['tmp_name'] === '') {
        return null;
    }
    $mtime = @filemtime($file['tmp_name']);
    if ($mtime === false) {
        return null;
    }
    return date('Y-m-d H:i:s', $mtime);
}

function sort_link(string $label, string $column, string $currentSort, string $currentDir): string
{
    $nextDir = 'asc';
    $indicator = '';
    if ($currentSort === $column) {
        if ($currentDir === 'asc') {
            $nextDir = 'desc';
            $indicator = ' A-Z';
        } else {
            $nextDir = 'asc';
            $indicator = ' Z-A';
        }
    }

    $params = [
        'full_name' => $_GET['full_name'] ?? '',
        'identifier' => $_GET['identifier'] ?? '',
        'start_date' => $_GET['start_date'] ?? '',
        'end_date' => $_GET['end_date'] ?? '',
        'sort' => $column,
        'dir' => $nextDir,
    ];

    $query = http_build_query($params);
    $url = '/?' . $query;

    return '<a class="sort" href="' . e($url) . '">' . $label . $indicator . '</a>';
}

function upload_error_message(int $code): string
{
    $map = [
        UPLOAD_ERR_INI_SIZE => 'Dosya boyutu limitini asti.',
        UPLOAD_ERR_FORM_SIZE => 'Form boyutu limitini asti.',
        UPLOAD_ERR_PARTIAL => 'Dosya eksik yuklendi.',
        UPLOAD_ERR_NO_FILE => 'Dosya secilmedi.',
        UPLOAD_ERR_NO_TMP_DIR => 'Gecici klasor yok.',
        UPLOAD_ERR_CANT_WRITE => 'Disk yazma hatasi.',
        UPLOAD_ERR_EXTENSION => 'Yukleme eklenti tarafindan durduruldu.',
    ];

    return $map[$code] ?? 'Bilinmeyen yukleme hatasi.';
}

function normalize_uploads(array $files): array
{
    if (!is_array($files['name'])) {
        return [$files];
    }

    $items = [];
    $count = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($files['error'][$i] === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        $items[] = [
            'name' => $files['name'][$i],
            'type' => $files['type'][$i],
            'tmp_name' => $files['tmp_name'][$i],
            'error' => $files['error'][$i],
            'size' => $files['size'][$i],
        ];
    }

    return $items;
}

if ($action === 'logout') {
    logout_user();
    header('Location: /?action=login');
    exit;
}

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        if (login_user($username, $password)) {
            header('Location: /');
            exit;
        }
        $error = 'Kullanici adi veya sifre hatali.';
    }

    $config = get_config();
    ?>
    <!doctype html>
    <html lang="tr">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= e($config['app_name']) ?> — Giriş</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="/styles.css">
    </head>
    <body class="auth-page">
        <div class="auth-card">
            <div class="auth-logo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
            <h1><?= e($config['app_name']) ?></h1>
            <p class="auth-sub">BitLocker kurtarma anahtarı yönetim sistemi</p>
            <?php if ($error): ?>
                <div class="alert error">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <?= e($error) ?>
                </div>
            <?php endif; ?>
            <form method="post">
                <label>Kullanıcı Adı<input type="text" name="username" required autocomplete="username"></label>
                <label>Şifre<input type="password" name="password" required autocomplete="current-password"></label>
                <button type="submit" class="btn btn-primary">Giriş Yap</button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}

require_login();

$db = get_db();
purge_old_deleted($db);

$isTrash = ($action === 'trash');

if ($action === 'edit') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        $_SESSION['flash_error'] = 'Kayit bulunamadi.';
        header('Location: /');
        exit;
    }

    $stmt = $db->prepare('SELECT * FROM bitlocker_keys WHERE id = :id');
    $stmt->execute([':id' => $id]);
    $editRow = $stmt->fetch();
    if (!$editRow) {
        $_SESSION['flash_error'] = 'Kayit bulunamadi.';
        header('Location: /');
        exit;
    }
}

if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $returnUrl = sanitize_return_url($_POST['return_url'] ?? '/');
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $id = (int) ($_POST['id'] ?? 0);
        $fullName = trim($_POST['full_name'] ?? '');
        $deviceName = trim($_POST['device_name'] ?? '');
        $identifier = trim($_POST['identifier'] ?? '');
        $recoveryKey = trim($_POST['recovery_key'] ?? '');
        $sourceFilename = trim($_POST['source_filename'] ?? '');
        $sourceFileDate = normalize_datetime_input($_POST['source_file_date'] ?? '');
        $rawText = trim($_POST['raw_text'] ?? '');

        if ($fullName === '') {
            $fullName = 'BILINMIYOR';
        }
        $fullName = to_upper_tr($fullName);
        if ($deviceName !== '') {
            $deviceName = to_upper_tr($deviceName);
        }

        if ($recoveryKey === '') {
            $_SESSION['flash_error'] = 'Kurtarma anahtari bos olamaz.';
            header('Location: /?action=edit&id=' . $id);
            exit;
        }

        $stmt = $db->prepare('UPDATE bitlocker_keys SET full_name = :full_name, device_name = :device_name, identifier = :identifier, recovery_key = :recovery_key, source_filename = :source_filename, source_file_date = :source_file_date, raw_text = :raw_text WHERE id = :id');
        $stmt->execute([
            ':full_name' => $fullName,
            ':device_name' => $deviceName !== '' ? $deviceName : null,
            ':identifier' => $identifier !== '' ? $identifier : null,
            ':recovery_key' => $recoveryKey,
            ':source_filename' => $sourceFilename !== '' ? $sourceFilename : null,
            ':source_file_date' => $sourceFileDate !== '' ? $sourceFileDate : null,
            ':raw_text' => $rawText !== '' ? $rawText : null,
            ':id' => $id,
        ]);
        $_SESSION['flash_success'] = 'Kayit guncellendi.';
    }
    header('Location: ' . ($returnUrl ?? '/'));
    exit;
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $returnUrl = sanitize_return_url($_POST['return_url'] ?? '/');
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $db->prepare('UPDATE bitlocker_keys SET deleted_at = datetime("now") WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $_SESSION['flash_success'] = 'Kayit silindi.';
        }
    }
    header('Location: ' . ($returnUrl ?? '/'));
    exit;
}

if ($action === 'bulk_delete' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $returnUrl = sanitize_return_url($_POST['return_url'] ?? '/');
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $ids = $_POST['ids'] ?? [];
        $ids = array_values(array_filter(array_map('intval', (array) $ids)));
        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("UPDATE bitlocker_keys SET deleted_at = datetime('now') WHERE id IN ({$placeholders})");
            $stmt->execute($ids);
            $_SESSION['flash_success'] = 'Secilen kayitlar silindi.';
        }
    }
    header('Location: ' . ($returnUrl ?? '/'));
    exit;
}

if ($action === 'restore' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $returnUrl = sanitize_return_url($_POST['return_url'] ?? '/');
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $db->prepare('UPDATE bitlocker_keys SET deleted_at = NULL WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $_SESSION['flash_success'] = 'Kayit geri alindi.';
        }
    }
    header('Location: ' . ($returnUrl ?? '/'));
    exit;
}

if ($action === 'purge' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $returnUrl = sanitize_return_url($_POST['return_url'] ?? '/');
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $db->prepare('DELETE FROM bitlocker_keys WHERE id = :id');
            $stmt->execute([':id' => $id]);
            $_SESSION['flash_success'] = 'Kayit kalici silindi.';
        }
    }
    header('Location: ' . ($returnUrl ?? '/'));
    exit;
}

if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check($_POST['csrf'] ?? '')) {
        $_SESSION['flash_error'] = 'Guvenlik dogrulamasi basarisiz.';
    } else {
        $fullName = trim($_POST['full_name'] ?? '');
        $deviceName = trim($_POST['device_name'] ?? '');

        if ($fullName !== '') {
            $fullName = to_upper_tr($fullName);
        }
        if ($deviceName !== '') {
            $deviceName = to_upper_tr($deviceName);
        }

        if (empty($_FILES['key_file']['tmp_name'])) {
            $_SESSION['flash_error'] = 'Dosya secilmedi.';
        } else {
            $files = normalize_uploads($_FILES['key_file']);
            if (!$files) {
                $_SESSION['flash_error'] = 'Dosya secilmedi.';
                header('Location: /');
                exit;
            }
            $added = 0;
            $duplicates = 0;
            $failed = 0;
            $failedFiles = [];

            foreach ($files as $file) {
                if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
                    $failed++;
                    $failedFiles[] = [
                        'name' => $file['name'] ?? '(bilinmiyor)',
                        'reason' => upload_error_message((int) $file['error']),
                    ];
                    continue;
                }
                $content = extract_text_from_upload($file);
                $parsed = parse_bitlocker_text($content, $file['name']);
                $fileDate = get_file_date($file);

                $fileFullName = $fullName;
                if ($fileFullName === '' && !empty($parsed['full_name'])) {
                    $fileFullName = $parsed['full_name'];
                }
                if ($fileFullName !== '') {
                    $fileFullName = to_upper_tr($fileFullName);
                }

                if ($fileFullName === '') {
                    $fileFullName = 'BILINMIYOR';
                }
                if (!$parsed['recovery_key']) {
                    $failed++;
                    $failedFiles[] = [
                        'name' => $file['name'],
                        'reason' => 'Kurtarma anahtari bulunamadi.',
                    ];
                    continue;
                }

                if ($parsed['identifier']) {
                    $check = $db->prepare('SELECT id FROM bitlocker_keys WHERE recovery_key = :recovery_key AND identifier = :identifier');
                    $check->execute([
                        ':recovery_key' => $parsed['recovery_key'],
                        ':identifier' => $parsed['identifier'],
                    ]);
                } else {
                    $check = $db->prepare('SELECT id FROM bitlocker_keys WHERE recovery_key = :recovery_key AND identifier IS NULL');
                    $check->execute([
                        ':recovery_key' => $parsed['recovery_key'],
                    ]);
                }
                $existing = $check->fetch();

                if ($existing) {
                    $duplicates++;
                    continue;
                }

                $stmt = $db->prepare('INSERT INTO bitlocker_keys (full_name, device_name, identifier, recovery_key, source_filename, source_file_date, raw_text)
                    VALUES (:full_name, :device_name, :identifier, :recovery_key, :source_filename, :source_file_date, :raw_text)');
                $stmt->execute([
                    ':full_name' => $fileFullName,
                    ':device_name' => $deviceName !== '' ? $deviceName : null,
                    ':identifier' => $parsed['identifier'],
                    ':recovery_key' => $parsed['recovery_key'],
                    ':source_filename' => $file['name'],
                    ':source_file_date' => $fileDate,
                    ':raw_text' => $parsed['raw_text'],
                ]);
                $added++;
            }

            if ($added > 0) {
                $_SESSION['flash_success'] = "Kayit eklendi: {$added} dosya.";
            }
            if ($duplicates > 0 || $failed > 0) {
                $parts = [];
                if ($duplicates > 0) {
                    $parts[] = "Tekrar: {$duplicates}";
                }
                if ($failed > 0) {
                    $parts[] = "Hatali: {$failed}";
                }
                $_SESSION['flash_error'] = implode(' | ', $parts);
            }
            if ($failedFiles) {
                $_SESSION['upload_report'] = $failedFiles;
            }
        }
    }
    header('Location: /');
    exit;
}

$filterName = trim($_GET['full_name'] ?? '');
$filterIdentifier = trim($_GET['identifier'] ?? '');
$filterStartDate = trim($_GET['start_date'] ?? '');
$filterEndDate = trim($_GET['end_date'] ?? '');

$sort = $_GET['sort'] ?? 'full_name';
$dir = strtolower($_GET['dir'] ?? 'asc');
    $allowedSorts = [
        'full_name' => 'full_name',
        'device_name' => 'device_name',
        'identifier' => 'identifier',
        'recovery_key' => 'recovery_key',
        'source_file_date' => 'source_file_date',
        'uploaded_at' => 'uploaded_at',
    ];
if (!isset($allowedSorts[$sort])) {
    $sort = 'uploaded_at';
}
if (!in_array($dir, ['asc', 'desc'], true)) {
    $dir = 'desc';
}



function build_filter_where(string $mode = 'active'): array
{
    $filterName = trim($_GET['full_name'] ?? '');
    $filterIdentifier = trim($_GET['identifier'] ?? '');
    $filterStartDate = trim($_GET['start_date'] ?? '');
    $filterEndDate = trim($_GET['end_date'] ?? '');

    $where = ' FROM bitlocker_keys WHERE 1=1';
    $params = [];

    if ($filterName !== '') {
        $filterName = to_upper_tr($filterName);
        $where .= ' AND full_name LIKE :full_name';
        $params[':full_name'] = '%' . $filterName . '%';
    }
    if ($filterIdentifier !== '') {
        $where .= ' AND identifier LIKE :identifier';
        $params[':identifier'] = '%' . $filterIdentifier . '%';
    }
    if ($filterStartDate !== '') {
        $where .= ' AND date(uploaded_at) >= :start_date';
        $params[':start_date'] = $filterStartDate;
    }
    if ($filterEndDate !== '') {
        $where .= ' AND date(uploaded_at) <= :end_date';
        $params[':end_date'] = $filterEndDate;
    }

    if ($mode === 'active') {
        $where .= ' AND deleted_at IS NULL';
    } elseif ($mode === 'deleted') {
        $where .= ' AND deleted_at IS NOT NULL';
    }

    return [$where, $params];
}

if ($action === 'export') {
    [$where, $params] = build_filter_where('active');
    $query = 'SELECT *' . $where . ' ORDER BY ' . $allowedSorts[$sort] . ' ' . strtoupper($dir);
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="bitlocker-export.xls"');
    header('Pragma: no-cache');
    header('Expires: 0');

    echo "\xEF\xBB\xBF";
    echo "<table border=\"1\">";
    echo "<tr><th>Ad Soyad</th><th>Cihaz</th><th>Tan&#305;mlay&#305;c&#305;</th><th>Kurtarma Anahtar&#305;</th></tr>";
    foreach ($rows as $row) {
        echo "<tr>";
        echo "<td>" . e($row['full_name'] ?? '') . "</td>";
        echo "<td>" . e($row['device_name'] ?? '') . "</td>";
        echo "<td>" . e($row['identifier'] ?? '') . "</td>";
        echo "<td>" . e($row['recovery_key'] ?? '') . "</td>";
        echo "</tr>";
    }
    echo "</table>";
    exit;
}

[$where, $params] = build_filter_where($isTrash ? 'deleted' : 'active');
$query = 'SELECT *' . $where . ' ORDER BY ' . $allowedSorts[$sort] . ' ' . strtoupper($dir);

$stmt = $db->prepare($query);
$stmt->execute($params);
$rows = $stmt->fetchAll();

if (($_GET['ajax'] ?? '') === '1') {
    header('Content-Type: application/json; charset=UTF-8');
    $returnUrl = build_return_url();
    echo json_encode([
        'tbody' => render_table_rows($rows, 1, $returnUrl),
    ]);
    exit;
}

$config = get_config();
?>
<?php
$stmtStats = $db->query("SELECT COUNT(*) FROM bitlocker_keys WHERE deleted_at IS NULL");
$totalKeys = $stmtStats ? (int)$stmtStats->fetchColumn() : 0;
$stmtMonth = $db->query("SELECT COUNT(*) FROM bitlocker_keys WHERE deleted_at IS NULL AND strftime('%Y-%m', uploaded_at) = strftime('%Y-%m', 'now')");
$monthKeys = $stmtMonth ? (int)$stmtMonth->fetchColumn() : 0;
$stmtTrash = $db->query("SELECT COUNT(*) FROM bitlocker_keys WHERE deleted_at IS NOT NULL");
$trashCount = $stmtTrash ? (int)$stmtTrash->fetchColumn() : 0;
?>
<!doctype html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($config['app_name']) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="app-layout">
<aside class="sidebar">
    <div class="sidebar-logo">
        <div class="logo-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>
        <h1><?= e($config['app_name']) ?></h1>
        <p>BitLocker Yönetimi</p>
    </div>
    <nav class="sidebar-nav">
        <span class="nav-label">Menü</span>
        <a href="/" class="nav-link <?= (!$isTrash && empty($editRow)) ? 'active' : '' ?>">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Kayıtlar</span>
            <?php if ($totalKeys > 0): ?><span class="nav-badge" style="background:var(--accent)"><?= $totalKeys ?></span><?php endif; ?>
        </a>
        <a href="/?action=trash" class="nav-link <?= $isTrash ? 'active' : '' ?>">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>Çöp Kutusu</span>
            <?php if ($trashCount > 0): ?><span class="nav-badge"><?= $trashCount ?></span><?php endif; ?>
        </a>
        <a href="/?action=export&<?= e(http_build_query(['full_name'=>$filterName,'identifier'=>$filterIdentifier,'start_date'=>$filterStartDate,'end_date'=>$filterEndDate,'sort'=>$sort,'dir'=>$dir])) ?>" class="nav-link">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Excel'e Aktar</span>
        </a>
    </nav>
    <div class="sidebar-user">
        <div class="avatar"><?= strtoupper(substr(current_user()['username'] ?? 'U', 0, 1)) ?></div>
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
            <span class="user-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><?= e(current_user()['username'] ?? '') ?></span>
            <a href="/?action=logout" class="logout-link" title="Çıkış" style="display:flex; align-items:center; gap:4px; margin:0;">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                Oturumu Kapat
            </a>
        </div>
    </div>
</aside>
<main class="main-content">

<?php if ($message): ?><div id="php-flash-success" data-msg="<?= e($message) ?>" style="display:none"></div><?php endif; ?>
<?php if ($error): ?><div id="php-flash-error" data-msg="<?= e($error) ?>" style="display:none"></div><?php endif; ?>

<?php if (!$isTrash && empty($editRow)): ?>
<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-icon blue"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg></div>
        <div class="stat-info"><div class="stat-value"><?= $totalKeys ?></div><div class="stat-label">Toplam Kayıt</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon green"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg></div>
        <div class="stat-info"><div class="stat-value"><?= $monthKeys ?></div><div class="stat-label">Bu Ay Eklenen</div></div>
    </div>
    <div class="stat-card">
        <div class="stat-icon <?= $trashCount > 0 ? 'red' : 'amber' ?>"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
        <div class="stat-info"><div class="stat-value"><?= $trashCount ?></div><div class="stat-label">Çöp Kutusu</div></div>
    </div>
</div>
<?php endif; ?>
        <?php if (!empty($editRow)): ?>
            <?php $editReturn = sanitize_return_url($_GET['return'] ?? build_return_url()); ?>
            <div class="card">
                <div class="card-header">
                    <h2><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Kayıdı Düzenle</h2>
                    <a href="<?= e($editReturn) ?>" class="btn btn-ghost btn-sm">← Geri Dön</a>
                </div>
                <form method="post" action="/?action=update">
                    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                    <input type="hidden" name="id" value="<?= (int) $editRow['id'] ?>">
                    <input type="hidden" name="return_url" value="<?= e($editReturn) ?>">
                    <div class="grid">
                        <label>
                            Ad soyad
                            <input type="text" name="full_name" value="<?= e($editRow['full_name'] ?? '') ?>">
                        </label>
                        <label>
                            Cihaz adi
                            <input type="text" name="device_name" value="<?= e($editRow['device_name'] ?? '') ?>">
                        </label>
                        <label>
                            Tan&#305;mlay&#305;c&#305;
                            <input type="text" name="identifier" value="<?= e($editRow['identifier'] ?? '') ?>">
                        </label>
                        <label>
                            Kurtarma anahtari
                            <input type="text" name="recovery_key" value="<?= e($editRow['recovery_key'] ?? '') ?>">
                        </label>
                        <label>
                            Dosya adi
                            <input type="text" name="source_filename" value="<?= e($editRow['source_filename'] ?? '') ?>">
                        </label>
                        <label>
                            Dosya tarihi
                            <input type="datetime-local" name="source_file_date" value="<?= e(to_datetime_local($editRow['source_file_date'] ?? '')) ?>">
                        </label>
                        <label>
                            Ham metin
                            <textarea name="raw_text" rows="4"><?= e($editRow['raw_text'] ?? '') ?></textarea>
                        </label>
                    </div>
                    <div class="actions">
                        <button type="submit" class="btn btn-primary">Kaydet</button>
                        <a class="btn btn-ghost" href="<?= e($editReturn) ?>">İptal</a>
                    </div>
                </form>
            </div>
        <?php endif; ?>
        <?php if ($uploadReport): ?>
        <div class="card">
            <div class="card-header"><h2><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>Hatalı Dosyalar</h2></div>
            <div class="table-wrapper"><table><thead><tr><th>Dosya</th><th>Hata</th></tr></thead><tbody>
            <?php foreach ($uploadReport as $item): ?><tr><td><?= e($item['name']) ?></td><td style="color:var(--danger)"><?= e($item['reason']) ?></td></tr><?php endforeach; ?>
            </tbody></table></div>
        </div>
        <?php endif; ?>

        <?php if (!$isTrash): ?>
        <div class="card">
            <div class="card-header">
                <h2><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>Kayıtlar</h2>
            </div>
            <form method="get" id="filter-form">
            <div class="filter-bar">
                <input type="text" name="full_name" placeholder="Ad soyad ara..." value="<?= e($filterName) ?>" style="max-width:200px">
                <input type="text" name="identifier" placeholder="Tanımlayıcı ara..." value="<?= e($filterIdentifier) ?>" style="max-width:200px">
                <input type="date" name="start_date" value="<?= e($filterStartDate) ?>" style="max-width:150px">
                <input type="date" name="end_date" value="<?= e($filterEndDate) ?>" style="max-width:150px">
                <div class="filter-bar-actions">
                    <button type="submit" class="btn btn-primary btn-sm">Filtrele</button>
                    <a href="/" class="btn btn-ghost btn-sm">Temizle</a>
                    <button type="button" class="btn btn-success btn-sm" onclick="document.getElementById('modal-file-input').click()">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Yeni Yükle
                    </button>
                    <a href="/?action=export&<?= e(http_build_query(['full_name'=>$filterName,'identifier'=>$filterIdentifier,'start_date'=>$filterStartDate,'end_date'=>$filterEndDate,'sort'=>$sort,'dir'=>$dir])) ?>" class="btn btn-ghost btn-sm export-btn">Excel'e Aktar</a>
                </div>
            </div>
            </form>
            <div class="bulk-bar">
                <span style="font-size:12px;color:var(--ink3)">Satırı tıklayınca ham metni görürsünüz</span>
                <form method="post" action="/?action=bulk_delete" id="bulk-delete-form">
                    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                    <input type="hidden" name="return_url" value="<?= e(build_return_url()) ?>">
                    <button type="button" class="btn btn-danger btn-sm" id="bulk-delete-btn" style="display:none" onclick="document.getElementById('bulk-delete-form').submit()">Seçilenleri Sil</button>
                </form>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th><input type="checkbox" id="select-all"></th>
                        <th>#</th>
                        <th><?= sort_link('Ad Soyad', 'full_name', $sort, $dir) ?></th>
                        <th><?= sort_link('Cihaz', 'device_name', $sort, $dir) ?></th>
                        <th><?= sort_link('Tanımlayıcı', 'identifier', $sort, $dir) ?></th>
                        <th><?= sort_link('Kurtarma Anahtarı', 'recovery_key', $sort, $dir) ?></th>
                        <th><?= sort_link('Dosya Tarihi', 'source_file_date', $sort, $dir) ?></th>
                        <th><?= sort_link('Yükleme', 'uploaded_at', $sort, $dir) ?></th>
                        <th>İşlem</th>
                    </tr></thead>
                    <tbody><?= render_table_rows($rows, 1, build_return_url()) ?></tbody>
                </table>
            </div>
        </div>
        <?php else: ?>
        <div class="card">
            <div class="card-header">
                <h2><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Çöp Kutusu</h2>
                <a href="/" class="btn btn-ghost btn-sm">← Kayıtlara Dön</a>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr>
                        <th>Ad Soyad</th><th>Cihaz</th><th>Tanımlayıcı</th>
                        <th>Kurtarma Anahtarı</th><th>Dosya Tarihi</th><th>Yükleme</th><th>Silinme</th><th>İşlem</th>
                    </tr></thead>
                    <tbody><?= render_trash_rows($rows, build_return_url(true)) ?></tbody>
                </table>
            </div>
        </div>
        <?php endif; ?>
</main></div>

<!-- Global dropzone overlay -->
<div id="global-dropzone" class="global-dropzone hidden">
    <div class="dropzone-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <h2>Dosyayı Buraya Bırakın</h2>
        <p>Txt, Html veya Pdf formatında kurtarma anahtarı dosyasını sayfaya bırakın</p>
    </div>
</div>

<!-- Upload modal -->
<div class="modal-overlay hidden" id="upload-modal">
    <div class="modal-box">
        <h3><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;vertical-align:-4px;margin-right:6px;color:var(--accent)"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Yeni Anahtar Yükle</h3>
        <p id="upload-modal-text" style="margin-bottom:16px;">Dosya seçildi. İsteğe bağlı olarak bu anahtarı bir kullanıcıya atayabilirsiniz.</p>
        <form method="post" enctype="multipart/form-data" action="/?action=upload" id="upload-modal-form" style="margin:0">
            <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
            <input type="file" id="modal-file-input" name="key_file[]" accept=".txt,.html,.htm,.pdf" multiple hidden required>
            
            <div style="margin-bottom:12px">
                <label>Ad Soyad
                    <input type="text" name="full_name" placeholder="örn. Ahmet Yılmaz">
                </label>
            </div>
            <div style="margin-bottom:24px">
                <label>Cihaz Adı (opsiyonel)
                    <input type="text" name="device_name" placeholder="örn. LAPTOP-ABC123">
                </label>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost" id="upload-modal-cancel">İptal</button>
                <button type="submit" class="btn btn-primary">Yükle ve Kaydet</button>
            </div>
        </form>
    </div>
</div>

<!-- toast container -->
<div id="toast-container"></div>

<!-- delete modal -->
<div class="modal-overlay hidden" id="delete-modal">
    <div class="modal-box">
        <h3>&#128465; Kaydı Sil</h3>
        <p id="delete-modal-text">Bu kaydı silmek istediğinizden emin misiniz? Kayıt çöp kutusuna taşınacaktır.</p>
        <div class="modal-actions">
            <button class="btn btn-ghost" id="delete-modal-cancel">İptal</button>
            <form method="post" action="/?action=delete" id="delete-modal-form" style="margin:0">
                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="id" id="delete-modal-id">
                <input type="hidden" name="return_url" id="delete-modal-return">
                <button type="submit" class="btn btn-danger">Evet, Sil</button>
            </form>
        </div>
    </div>
</div>

<script>
(function(){
    // ── Toast ────────────────────────────────────
    function toast(msg, type) {
        type = type || 'info';
        var icons = {
            success: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
            error:   '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
            info:    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        };
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        el.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
        var c = document.getElementById('toast-container');
        if (c) c.appendChild(el);
        setTimeout(function() {
            el.classList.add('fade-out');
            setTimeout(function(){ el.remove(); }, 350);
        }, 3500);
    }

    // Show PHP flash messages as toasts
    var fOk = document.getElementById('php-flash-success');
    var fErr = document.getElementById('php-flash-error');
    if (fOk) toast(fOk.dataset.msg, 'success');
    if (fErr) toast(fErr.dataset.msg, 'error');

    // ── Delete Modal ─────────────────────────────
    var modal = document.getElementById('delete-modal');
    var modalText = document.getElementById('delete-modal-text');
    var modalId = document.getElementById('delete-modal-id');
    var modalReturn = document.getElementById('delete-modal-return');
    var modalCancel = document.getElementById('delete-modal-cancel');

    function openDeleteModal(id, name, returnUrl) {
        modalText.textContent = '"' + name + '" kaydını silmek istediğinizden emin misiniz?';
        modalId.value = id;
        modalReturn.value = returnUrl;
        modal.classList.remove('hidden');
    }

    if (modalCancel) modalCancel.addEventListener('click', function(){ modal.classList.add('hidden'); });
    if (modal) modal.addEventListener('click', function(e){ if(e.target===modal) modal.classList.add('hidden'); });

    document.addEventListener('click', function(e) {
        var btn = e.target.closest('.open-delete-modal');
        if (btn) {
            e.preventDefault();
            openDeleteModal(btn.dataset.id, btn.dataset.name, btn.dataset.return);
        }
    });

    // ── Select All + bulk delete btn ─────────────
    var selectAll = document.getElementById('select-all');
    var bulkBtn = document.getElementById('bulk-delete-btn');
    function updateBulkBtn() {
        var checked = document.querySelectorAll('input[name="ids[]"]:checked').length;
        if (bulkBtn) bulkBtn.style.display = checked > 0 ? '' : 'none';
    }
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            document.querySelectorAll('input[name="ids[]"]').forEach(function(cb){ cb.checked = selectAll.checked; });
            updateBulkBtn();
        });
    }
    document.addEventListener('change', function(e) {
        if (e.target && e.target.name === 'ids[]') updateBulkBtn();
    });

    // ── Uppercase TR ─────────────────────────────
    document.querySelectorAll('input[name="full_name"], input[name="device_name"]').forEach(function(el) {
        el.addEventListener('blur', function(){ el.value = el.value.toLocaleUpperCase('tr-TR'); });
    });

    // ── Global Dropzone & Upload Modal ──────────
    var globalDropzone = document.getElementById('global-dropzone');
    var uploadModal = document.getElementById('upload-modal');
    var modalFileInput = document.getElementById('modal-file-input');
    var uploadModalCancel = document.getElementById('upload-modal-cancel');
    var uploadModalText = document.getElementById('upload-modal-text');
    var dragTimer;

    document.addEventListener('dragover', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.types && Array.from(e.dataTransfer.types).indexOf('Files') !== -1) {
            if (globalDropzone) globalDropzone.classList.add('active');
            clearTimeout(dragTimer);
        }
    });

    document.addEventListener('dragleave', function(e) {
        e.preventDefault(); e.stopPropagation();
        clearTimeout(dragTimer);
        dragTimer = setTimeout(function() {
            if (globalDropzone) globalDropzone.classList.remove('active');
        }, 150);
    });

    document.addEventListener('drop', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (globalDropzone) globalDropzone.classList.remove('active');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (modalFileInput) {
                modalFileInput.files = e.dataTransfer.files;
                if (uploadModal) {
                    var num = e.dataTransfer.files.length;
                    uploadModalText.textContent = num + ' adet dosya seçildi. İsteğe bağlı olarak bu anahtarı bir cihaza/kullanıcıya atayabilirsiniz.';
                    uploadModal.classList.remove('hidden');
                }
            }
        }
    });

    if (uploadModalCancel) {
        uploadModalCancel.addEventListener('click', function() {
            uploadModal.classList.add('hidden');
            if (modalFileInput) modalFileInput.value = '';
        });
    }

    if (modalFileInput) {
        modalFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                var num = this.files.length;
                uploadModalText.textContent = num + ' adet dosya seçildi. İsteğe bağlı olarak bu anahtarı bir cihaza/kullanıcıya atayabilirsiniz.';
                uploadModal.classList.remove('hidden');
            }
        });
    }

    // ── Key toggle + copy ────────────────────────
    function copyText(val) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(val).then(function(){ toast('Anahtar kopyalandı!', 'success'); }).catch(function(){ fallbackCopy(val); });
        } else { fallbackCopy(val); toast('Anahtar kopyalandı!', 'success'); }
    }
    function fallbackCopy(val) {
        var ta = document.createElement('textarea');
        ta.value = val; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(e){}
        document.body.removeChild(ta);
    }

    function bindKeyControls() {
        document.querySelectorAll('.key-toggle-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var span = btn.closest('.key-cell').querySelector('.key-masked, .key-visible');
                if (!span) return;
                if (span.classList.contains('key-masked')) {
                    span.textContent = span.dataset.key;
                    span.className = 'key-visible';
                    span.dataset.key = span.textContent;
                } else {
                    var masked = span.dataset.key.replace(/\d{6}/g, '••••••');
                    span.textContent = masked;
                    span.className = 'key-masked';
                }
            };
        });
        document.querySelectorAll('.copy-btn').forEach(function(btn) {
            btn.onclick = function(e) { e.stopPropagation(); copyText(btn.dataset.key); };
        });
    }
    bindKeyControls();

    // ── Row expand (raw text) ────────────────────
    document.addEventListener('click', function(e) {
        var row = e.target.closest('tbody tr[data-id]');
        if (!row) return;
        if (e.target.closest('button, a, input, .key-cell')) return;
        var id = row.dataset.id;
        var expandRow = document.getElementById('expand-' + id);
        if (!expandRow) return;
        var isVisible = expandRow.style.display !== 'none';
        document.querySelectorAll('.expand-row').forEach(function(r){ r.style.display='none'; });
        document.querySelectorAll('tr[data-id]').forEach(function(r){ r.classList.remove('expanded'); });
        if (!isVisible) { expandRow.style.display=''; row.classList.add('expanded'); }
    });

    // ── Filter (debounce AJAX) ───────────────────
    var filterForm = document.getElementById('filter-form');
    if (filterForm) {
        var filterTimer = null;
        var tbody = document.querySelector('table tbody');
        var exportBtn = document.querySelector('.export-btn');
        var triggerFilter = function() {
            clearTimeout(filterTimer);
            filterTimer = setTimeout(function() {
                var formData = new FormData(filterForm);
                var params = new URLSearchParams(formData);
                params.set('ajax', '1');
                if (exportBtn) { var ep = new URLSearchParams(formData); ep.set('action','export'); exportBtn.href = '/?' + ep.toString(); }
                fetch('/?' + params.toString(), {headers:{'X-Requested-With':'fetch'}})
                    .then(function(r){ return r.json(); })
                    .then(function(d){ if(tbody && d.tbody!==undefined){ tbody.innerHTML = d.tbody; bindKeyControls(); } })
                    .catch(function(){});
            }, 350);
        };
        filterForm.addEventListener('submit', function(e){ e.preventDefault(); triggerFilter(); });
        filterForm.querySelectorAll('input[type="text"]').forEach(function(i){ i.addEventListener('input', triggerFilter); });
        filterForm.querySelectorAll('input[type="date"]').forEach(function(i){ i.addEventListener('change', triggerFilter); });
    }

    // ── Focus filter field on load ───────────────
    var urlParams = new URLSearchParams(window.location.search);
    var focusField = urlParams.get('full_name') ? 'full_name' : (urlParams.get('identifier') ? 'identifier' : null);
    if (focusField) {
        var inp = document.querySelector('input[name="' + focusField + '"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
})();



</script>
</body>
</html>
