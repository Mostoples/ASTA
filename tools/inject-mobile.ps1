# Menyisipkan mobile.css dan menyetel meta viewport pada semua halaman
$root = Split-Path -Parent $PSScriptRoot
$files = Get-ChildItem $root -Filter *.html -File
$changed = 0

foreach ($f in $files) {
  $t = Get-Content $f.FullName -Raw
  $orig = $t

  # 1. Muat mobile.css paling akhir agar dapat menimpa aturan lain
  if ($t -notmatch 'css/mobile\.css') {
    $t = $t -replace '(<link rel="stylesheet" href="css/features\.css">)', "`$1`n<link rel=""stylesheet"" href=""css/mobile.css"">"
  }

  # 2. Viewport: izinkan zoom (aksesibilitas) + aman untuk notch
  $t = $t -replace '<meta name="viewport"[^>]*>', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'

  # 3. Tambahkan meta aplikasi web mobile bila belum ada
  if ($t -notmatch 'mobile-web-app-capable') {
    $t = $t -replace '(<meta name="theme-color"[^>]*>)', "`$1`n<meta name=""mobile-web-app-capable"" content=""yes"">`n<meta name=""apple-mobile-web-app-capable"" content=""yes"">`n<meta name=""apple-mobile-web-app-status-bar-style"" content=""default"">`n<meta name=""format-detection"" content=""telephone=no"">"
  }

  if ($t -ne $orig) {
    [System.IO.File]::WriteAllText($f.FullName, $t, (New-Object System.Text.UTF8Encoding $false))
    $changed++
    Write-Host "  diperbarui: $($f.Name)"
  }
}
Write-Host "`n$changed dari $($files.Count) halaman diperbarui."
