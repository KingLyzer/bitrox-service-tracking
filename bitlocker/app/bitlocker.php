<?php

declare(strict_types=1);

function normalize_bitlocker_text(string $content): string
{
    $content = convert_text_to_utf8($content);
    $content = str_replace(["\r\n", "\r"], "\n", $content);
    return trim($content);
}

function convert_text_to_utf8(string $content): string
{
    if ($content === '') {
        return $content;
    }

    $hasNulls = strpos($content, "\0") !== false;
    $bom = substr($content, 0, 2);

    if ($bom === "\xFF\xFE" || $bom === "\xFE\xFF") {
        if (function_exists('iconv')) {
            $encoding = ($bom === "\xFF\xFE") ? 'UTF-16LE' : 'UTF-16BE';
            $converted = iconv($encoding, 'UTF-8//IGNORE', $content);
            if ($converted !== false) {
                return $converted;
            }
        }
    }

    if ($hasNulls && function_exists('iconv')) {
        $converted = iconv('UTF-16LE', 'UTF-8//IGNORE', $content);
        if ($converted !== false) {
            return $converted;
        }
    }

    return $content;
}

function parse_bitlocker_text(string $content, ?string $filename = null): array
{
    $text = normalize_bitlocker_text($content);

    $identifier = null;
    if (preg_match('/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/', $text, $matches)) {
        $identifier = strtoupper($matches[0]);
    }

    $recovery_key = null;
    if (preg_match('/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/', $text, $matches)) {
        $recovery_key = $matches[0];
    }

    $full_name = null;
    if ($filename) {
        $fromName = extract_from_filename($filename);
        if (!$identifier && $fromName['identifier']) {
            $identifier = $fromName['identifier'];
        }
        if (!$recovery_key && $fromName['recovery_key']) {
            $recovery_key = $fromName['recovery_key'];
        }
        $full_name = $fromName['full_name'];
    }

    return [
        'identifier' => $identifier,
        'recovery_key' => $recovery_key,
        'full_name' => $full_name ? to_upper_tr($full_name) : null,
        'raw_text' => $text,
    ];
}

function extract_text_from_upload(array $file): string
{
    $content = file_get_contents($file['tmp_name']);
    if ($content === false) {
        return '';
    }

    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (in_array($extension, ['html', 'htm'], true)) {
        $content = strip_tags($content);
    } elseif ($extension === 'pdf') {
        $content = extract_text_from_pdf($file['tmp_name']);
    }

    return $content;
}

function extract_text_from_pdf(string $path): string
{
    $cmd = 'pdftotext -layout ' . escapeshellarg($path) . ' -';
    $output = shell_exec($cmd);
    if (!is_string($output)) {
        return '';
    }

    return $output;
}

function extract_from_filename(string $filename): array
{
    $base = pathinfo($filename, PATHINFO_FILENAME);
    $identifier = null;
    $recovery_key = null;

    if (preg_match('/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/', $base, $matches)) {
        $identifier = strtoupper($matches[0]);
    }

    if (preg_match('/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/', $base, $matches)) {
        $recovery_key = $matches[0];
    }

    $name = $base;
    if ($identifier) {
        $name = str_replace($identifier, ' ', $name);
    }
    if ($recovery_key) {
        $name = str_replace($recovery_key, ' ', $name);
    }
    $name = preg_replace('/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/', ' ', $name);
    $name = preg_replace('/\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b/', ' ', $name);
    $name = preg_replace('/\b(sifre|sifresi|recovery|bitlocker|kurtarma|anahtar|anahtari|key)\b/iu', ' ', $name);
    $name = preg_replace('/\d+/', ' ', $name);
    $name = preg_replace('/[._-]+/', ' ', $name);
    $name = trim(preg_replace('/\s+/', ' ', $name));

    $trailing = extract_trailing_name($name);
    if ($trailing !== '') {
        return [
            'identifier' => $identifier,
            'recovery_key' => $recovery_key,
            'full_name' => $trailing,
        ];
    }

    $tokens = preg_split('/[^\p{L}]+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
    if ($tokens) {
        $tokens = array_filter($tokens, function (string $token): bool {
            if (function_exists('mb_strlen')) {
                return mb_strlen($token, 'UTF-8') >= 2;
            }
            return strlen($token) >= 2;
        });
    }
    if ($tokens) {
        $stop = ['ANAHTAR', 'ANAHTARI', 'ANAHTARLARI', 'BITLOCKER', 'RECOVERY', 'KURTARMA', 'KEY', 'SIFRE', 'SIFRESI'];
        $tokens = array_values(array_filter($tokens, function (string $token) use ($stop): bool {
            return !in_array(to_upper_tr($token), $stop, true);
        }));
    }
    if ($tokens) {
        $tokens = array_values(array_filter($tokens, function (string $token): bool {
            return preg_match('/[AEIOUÖÜİIaeiouöüıi]/u', $token) === 1;
        }));
    }
    if ($tokens && count($tokens) > 4) {
        $tokens = array_slice($tokens, -4);
    }
    $name = $tokens ? implode(' ', $tokens) : '';

    return [
        'identifier' => $identifier,
        'recovery_key' => $recovery_key,
        'full_name' => $name !== '' ? $name : null,
    ];
}

function to_upper_tr(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return $value;
    }

    $map = [
        'i' => 'İ',
        'ı' => 'I',
        'ş' => 'Ş',
        'ğ' => 'Ğ',
        'ü' => 'Ü',
        'ö' => 'Ö',
        'ç' => 'Ç',
    ];

    $value = strtr($value, $map);
    return strtoupper($value);
}

function extract_trailing_name(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    if (preg_match('/(?:^|\\s)([\\p{L}]{2,}(?:\\s+[\\p{L}]{2,}){1,3})\\s*$/u', $value, $matches)) {
        $tokens = preg_split('/\\s+/u', trim($matches[1]), -1, PREG_SPLIT_NO_EMPTY);
        if ($tokens) {
            $stop = ['ANAHTAR', 'ANAHTARI', 'ANAHTARLARI', 'BITLOCKER', 'RECOVERY', 'KURTARMA', 'KEY', 'SIFRE', 'SIFRESI'];
            $tokens = array_values(array_filter($tokens, function (string $token) use ($stop): bool {
                return !in_array(to_upper_tr($token), $stop, true);
            }));

            $hasLong = false;
            foreach ($tokens as $token) {
                if (function_exists('mb_strlen')) {
                    if (mb_strlen($token, 'UTF-8') >= 4) {
                        $hasLong = true;
                        break;
                    }
                } elseif (strlen($token) >= 4) {
                    $hasLong = true;
                    break;
                }
            }

            if ($hasLong) {
                $tokens = array_values(array_filter($tokens, function (string $token): bool {
                    if (function_exists('mb_strlen')) {
                        return mb_strlen($token, 'UTF-8') >= 4;
                    }
                    return strlen($token) >= 4;
                }));
            }

            $tokens = array_values(array_filter($tokens, function (string $token): bool {
                return preg_match('/[AEIOUÖÜİIaeiouöüıi]/u', $token) === 1;
            }));

            if (count($tokens) > 4) {
                $tokens = array_slice($tokens, -4);
            }
        }

        return $tokens ? implode(' ', $tokens) : '';
    }

    return '';
}
