# Schönes ASCII-Art Banner
Write-Host @"
╔══════════════════════════════════════════╗
║             BambuCAM Setup               ║
║        Modern 3D Printer Monitoring      ║
╚══════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Prüfe Admin-Rechte
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️ Diese Installation benötigt Administrator-Rechte." -ForegroundColor Yellow
    Write-Host "Starte PowerShell als Administrator und versuche es erneut." -ForegroundColor Yellow
    pause
    exit
}

# Prüfe Docker Installation
Write-Host "🔍 Prüfe Docker Installation..." -ForegroundColor Cyan
$dockerVersion = docker --version 2>$null
if (-not $?) {
    Write-Host "❌ Docker ist nicht installiert!" -ForegroundColor Red
    $installDocker = Read-Host "Möchten Sie Docker Desktop jetzt installieren? (j/n)"
    if ($installDocker -eq 'j') {
        Write-Host "📥 Lade Docker Desktop herunter..." -ForegroundColor Cyan
        $dockerUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
        $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
        Invoke-WebRequest -Uri $dockerUrl -OutFile $dockerInstaller
        Write-Host "⚙️ Installiere Docker Desktop..." -ForegroundColor Cyan
        Start-Process -Wait $dockerInstaller
        Remove-Item $dockerInstaller
    } else {
        Write-Host "❌ Installation abgebrochen. Docker wird benötigt." -ForegroundColor Red
        pause
        exit
    }
}

# Prüfe Git Installation
Write-Host "🔍 Prüfe Git Installation..." -ForegroundColor Cyan
$gitVersion = git --version 2>$null
if (-not $?) {
    Write-Host "❌ Git ist nicht installiert!" -ForegroundColor Red
    $installGit = Read-Host "Möchten Sie Git jetzt installieren? (j/n)"
    if ($installGit -eq 'j') {
        Write-Host "📥 Lade Git herunter..." -ForegroundColor Cyan
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
        $gitInstaller = "$env:TEMP\GitInstaller.exe"
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller
        Write-Host "⚙️ Installiere Git..." -ForegroundColor Cyan
        Start-Process -Wait $gitInstaller "/VERYSILENT"
        Remove-Item $gitInstaller
    } else {
        Write-Host "❌ Installation abgebrochen. Git wird benötigt." -ForegroundColor Red
        pause
        exit
    }
}

# Hole neueste Version von GitHub
Write-Host "📥 Lade neueste Version von BambuCAM..." -ForegroundColor Cyan
$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/YOURUSERNAME/BambuCAM/releases/latest"
$latestVersion = $releases.tag_name
Write-Host "✨ Neueste Version: $latestVersion" -ForegroundColor Green

# Erstelle Installations-Verzeichnis
$installDir = "$env:LOCALAPPDATA\BambuCAM"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

# Lade und entpacke Release
$downloadUrl = $releases.zipball_url
$zipFile = "$env:TEMP\BambuCAM.zip"
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath $installDir -Force
Remove-Item $zipFile

# Erstelle Desktop-Verknüpfung
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\BambuCAM.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$installDir\start.ps1`""
$Shortcut.IconLocation = "$installDir\frontend\src\assets\printer-icon.png"
$Shortcut.Save()

# Starte Docker Compose
Write-Host "🚀 Starte BambuCAM..." -ForegroundColor Cyan
Set-Location $installDir
docker-compose up --build -d

# Öffne Browser
Start-Process "http://localhost"

# Create required directories
New-Item -ItemType Directory -Force -Path ".\backend\data"
New-Item -ItemType Directory -Force -Path ".\backend\data\printers"
New-Item -ItemType Directory -Force -Path ".\backend\data\go2rtc"

if (-not (Test-Path ".\backend\data\go2rtc\go2rtc.yaml")) {
    New-Item -ItemType File -Path ".\backend\data\go2rtc\go2rtc.yaml"
}

Write-Host @"

✅ Installation abgeschlossen!
🌐 BambuCAM läuft auf: http://localhost
🖥️ Eine Desktop-Verknüpfung wurde erstellt.

Drücken Sie eine Taste zum Beenden...
"@ -ForegroundColor Green
pause 