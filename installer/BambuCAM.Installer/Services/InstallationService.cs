using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO;
using BambuCAM.Installer.Models;
using System.Diagnostics;

namespace BambuCAM.Installer.Services
{
    public class InstallationService
    {
        private readonly DockerService _dockerService;
        private readonly NetworkService _networkService;
        private readonly DownloadService _downloadService;
        private readonly ShortcutService _shortcutService;
        private readonly string _serverIp;

        public InstallationService()
        {
            _dockerService = new DockerService();
            _networkService = new NetworkService();
            _downloadService = new DownloadService();
            _shortcutService = new ShortcutService();
            _serverIp = NetworkService.GetLocalIPAddress();
        }

        public async Task<InstallationProgress> Install(
            IProgress<InstallationStatus> progress,
            bool createShortcut = true)
        {
            try
            {
                // Check Docker (20%)
                progress.Report(new InstallationStatus(0, "Checking Docker installation..."));
                if (!_dockerService.IsDockerInstalled())
                {
                    progress.Report(new InstallationStatus(10, "Installing Docker Desktop..."));
                    await _dockerService.InstallDocker();
                }

                // Configure WSL (40%)
                progress.Report(new InstallationStatus(20, "Configuring WSL..."));
                await ConfigureWsl();

                // Start Docker if needed
                var dockerRunning = await _dockerService.CheckDockerRunning();
                if (!dockerRunning)
                {
                    progress.Report(new InstallationStatus(40, "Starting Docker Desktop..."));
                    await _dockerService.StartDockerDesktop();
                }

                // Check ports (35%)
                progress.Report(new InstallationStatus(35, "Checking port availability..."));
                await _networkService.CheckRequiredPorts();

                // Download and extract (70%)
                progress.Report(new InstallationStatus(35, "Downloading BambuCAM..."));
                await _downloadService.DownloadAndExtract(progress);

                // Start containers (85%)
                progress.Report(new InstallationStatus(70, "Starting Docker containers..."));
                await _dockerService.StartContainers();

                // Wait for services (95%)
                progress.Report(new InstallationStatus(85, "Waiting for services to start...", "This may take a few minutes"));
                await WaitForServices();

                // Create shortcut if requested
                if (createShortcut)
                {
                    progress.Report(new InstallationStatus(95, "Creating desktop shortcut..."));
                    _shortcutService.CreateDesktopShortcut(
                        $"http://{_serverIp}",
                        "BambuCAM"
                    );
                }

                // Nach dem Docker-Start
                var portForwardService = new WslPortForwardService();
                await portForwardService.StartPortForwarding();

                // Complete
                progress.Report(new InstallationStatus(100, "Installation completed successfully!"));
                return InstallationProgress.Successful;
            }
            catch (Exception ex)
            {
                string errorMessage = ex.Message;
                if (errorMessage.Contains("Connection refused"))
                {
                    errorMessage = $"Could not connect to BambuCAM services at {_serverIp}. Please check if your firewall is blocking the connection.";
                }
                return InstallationProgress.Failure(errorMessage);
            }
        }

        private async Task WaitForServices()
        {
            using var client = new HttpClient();
            var endpoints = new[]
            {
                $"http://{_serverIp}",
                $"http://{_serverIp}:4000/api/health",
                $"http://{_serverIp}:1984/api/status"
            };

            foreach (var endpoint in endpoints)
            {
                var retries = 30;
                while (retries-- > 0)
                {
                    try
                    {
                        var response = await client.GetAsync(endpoint);
                        if (response.IsSuccessStatusCode) break;
                    }
                    catch
                    {
                        if (retries == 0) 
                            throw new Exception($"Service at {endpoint} did not respond. Installation may have failed.");
                        await Task.Delay(1000);
                    }
                }
            }
        }

        private async Task ConfigureWsl()
        {
            try
            {
                // Prüfe ob Docker Desktop läuft und WSL2 aktiv ist
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "wsl",
                        Arguments = "--status",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true  // Verstecke das Fenster
                    }
                };
                process.Start();
                await process.WaitForExitAsync();

                // Erstelle .wslconfig
                var wslConfigPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    ".wslconfig"
                );

                var wslConfig = @"[wsl2]
localhostForwarding=true
networkingMode=bridged  # Verbesserte Netzwerk-Konnektivität
ports=80,4000,1984     # Explizit die Ports freigeben";

                await File.WriteAllTextAsync(wslConfigPath, wslConfig);

                // Führe alle Befehle in einer einzigen elevated PowerShell aus
                var script = @"
                    # Port-Forwarding
                    $wslIp = (wsl hostname -I).Trim().Split(' ')[0]
                    $ports = @(80, 4000, 1984)
                    foreach ($port in $ports) {
                        netsh interface portproxy delete v4tov4 listenport=$port
                        netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=$wslIp
                        New-NetFirewallRule -DisplayName ""BambuCAM Port $port"" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -ErrorAction SilentlyContinue
                    }
                    
                    # WSL neu starten
                    wsl --shutdown
                    Start-Sleep -Seconds 5
                    wsl --status";

                var scriptPath = Path.Combine(Path.GetTempPath(), "configure-wsl.ps1");
                await File.WriteAllTextAsync(scriptPath, script);

                var psProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "powershell",
                        Arguments = $"-ExecutionPolicy Bypass -File {scriptPath}",
                        UseShellExecute = true,
                        Verb = "runas",
                        CreateNoWindow = true
                    }
                };
                psProcess.Start();
                await psProcess.WaitForExitAsync();

                // Cleanup
                File.Delete(scriptPath);
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to configure WSL: {ex.Message}");
            }
        }

        private async Task<string> GetWslIp()
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "wsl",
                    Arguments = "hostname -I",
                    UseShellExecute = false,
                    RedirectStandardOutput = true
                }
            };
            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync();
            await process.WaitForExitAsync();
            return output.Trim().Split(' ')[0];
        }
    }
} 