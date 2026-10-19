$ErrorActionPreference = 'Stop'

$php = Get-Command php -ErrorAction SilentlyContinue
if (-not $php) {
    Write-Error 'PHP bulunamadi. Once ./setup.ps1 calistirin.'
    exit 1
}

Write-Host 'Sunucu basladi: http://localhost:8000'
Start-Process 'http://localhost:8000'
php -S localhost:8000 -t public
