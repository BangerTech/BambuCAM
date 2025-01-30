# Prüfe ob Script als Administrator läuft
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Bitte Script als Administrator ausführen!"
    Break
}

# Funktion zum Überprüfen der Docker-Installation
function Test-DockerInstallation {
    try {
        $docker = Get-Command docker -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Funktion zum Installieren von Docker Desktop
function Install-DockerDesktop {
    Write-Host "Docker wird installiert..."
    
    # Docker Desktop Installer herunterladen
    $dockerUrl = "https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe"
    $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
    
    Invoke-WebRequest -Uri $dockerUrl -OutFile $installerPath
    
    # Installer ausführen
    Start-Process -Wait $installerPath -ArgumentList "install --quiet"
    Remove-Item $installerPath
    
    Write-Host "Docker wurde installiert. Bitte starten Sie Ihren Computer neu und führen Sie das Script erneut aus."
    exit
}

# Prüfe ob Docker installiert ist
if (-not (Test-DockerInstallation)) {
    Write-Host "Docker ist nicht installiert."
    $install = Read-Host "Möchten Sie Docker Desktop installieren? (J/N)"
    if ($install -eq 'J') {
        Install-DockerDesktop
    }
    else {
        Write-Host "Docker wird für diese App benötigt. Installation wird abgebrochen."
        exit
    }
}

# Prüfe ob Docker läuft
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Write-Host "Docker Desktop wird gestartet..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Warte 30 Sekunden bis Docker gestartet ist..."
    Start-Sleep -Seconds 30
}

# Erstelle App-Verzeichnis
$appPath = "$env:USERPROFILE\BambuLabViewer"
if (Test-Path $appPath) {
    Remove-Item -Path $appPath -Recurse -Force
}

# Kopiere App-Dateien aus dem lokalen app-Ordner
$sourceDir = Join-Path $PSScriptRoot "app"
Copy-Item -Path $sourceDir -Destination $appPath -Recurse

# Wechsel ins App-Verzeichnis
Set-Location $appPath

# Stoppe eventuell laufende Container
docker-compose down

# Starte die App
Write-Host "Starte BambuLab Camera Viewer..."
docker-compose up --build -d

# Öffne Browser
Start-Sleep -Seconds 10
Start-Process "http://localhost:3000"

Write-Host @"

BambuLab Camera Viewer wurde gestartet!

Sie können die App nun im Browser unter folgenden Adressen aufrufen:
- http://localhost:3000
- http://$($(ipconfig | Select-String "IPv4").ToString().Split()[-1]):3000

Zum Beenden der App dieses Fenster schließen und 'J' eingeben.

"@

# Warte auf Benutzereingabe zum Beenden
$exit = Read-Host "Möchten Sie die App beenden? (J/N)"
if ($exit -eq 'J') {
    docker-compose down
    Write-Host "App wurde beendet."
} 