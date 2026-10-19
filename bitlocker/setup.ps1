$ErrorActionPreference = 'Stop'

Write-Host 'BitLocker Key Vault kurulum basliyor...'

$php = Get-Command php -ErrorAction SilentlyContinue
if (-not $php) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host 'PHP yukleniyor (winget)...'
        winget install --id=PHP.PHP -e --source winget
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host 'PHP yukleniyor (choco)...'
        choco install php -y
    } else {
        Write-Error 'PHP bulunamadi. Lutfen PHP 8+ yukleyin ve tekrar deneyin.'
        exit 1
    }
}

$adminUser = Read-Host 'Admin kullanici adi (varsayilan: itadmin)'
if ([string]::IsNullOrWhiteSpace($adminUser)) {
    $adminUser = 'itadmin'
}

$securePass = Read-Host 'Admin sifresi' -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
$adminPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

if ([string]::IsNullOrWhiteSpace($adminPass)) {
    Write-Error 'Sifre bos olamaz.'
    exit 1
}

Write-Host 'Veritabani olusturuluyor...'
php scripts/init.php --admin-user "$adminUser" --admin-pass "$adminPass"

Write-Host 'Kurulum tamamlandi.'
Write-Host 'Uygulamayi calistirmak icin: ./run.ps1'
