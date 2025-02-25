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
                // Check Docker (25%)
                progress.Report(new InstallationStatus(0, "Checking Docker installation..."));
                if (!_dockerService.IsDockerInstalled())
                {
                    progress.Report(new InstallationStatus(10, "Installing Docker Desktop..."));
                    await _dockerService.InstallDocker();
                }
                else
                {
                    // Docker ist installiert, prüfe ob es läuft
                    var dockerRunning = await _dockerService.CheckDockerRunning();
                    if (!dockerRunning)
                    {
                        progress.Report(new InstallationStatus(10, "Starting Docker Desktop..."));
                        await _dockerService.StartDockerDesktop();
                    }
                }

                // Check ports (35%)
                progress.Report(new InstallationStatus(25, "Checking port availability..."));
                await _networkService.CheckRequiredPorts();

                // Download and extract (70%)
                progress.Report(new InstallationStatus(35, "Downloading BambuCAM..."));
                await _downloadService.DownloadAndExtract(progress);

                // Configure WSL (60%)
                progress.Report(new InstallationStatus(60, "Configuring WSL..."));
                await ConfigureWsl();

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
                // Erstelle .wslconfig
                var wslConfigPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    ".wslconfig"
                );

                await File.WriteAllTextAsync(wslConfigPath, @"[wsl2]
localhostForwarding=true");

                // Führe WSL-Befehle aus
                var wslIp = await GetWslIp();

                // Port-Forwarding Regeln hinzufügen (erfordert Admin-Rechte)
                var ports = new[] { 80, 4000, 1984 };
                foreach (var port in ports)
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "netsh",
                            Arguments = $"interface portproxy add v4tov4 listenport={port} listenaddress=0.0.0.0 connectport={port} connectaddress={wslIp}",
                            UseShellExecute = true,
                            Verb = "runas"  // Als Administrator ausführen
                        }
                    };
                    process.Start();
                    await process.WaitForExitAsync();
                }

                // Firewall-Regeln hinzufügen (erfordert Admin-Rechte)
                foreach (var port in ports)
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "powershell",
                            Arguments = $"-Command New-NetFirewallRule -DisplayName \"BambuCAM Port {port}\" -Direction Inbound -Action Allow -Protocol TCP -LocalPort {port}",
                            UseShellExecute = true,
                            Verb = "runas"
                        }
                    };
                    process.Start();
                    await process.WaitForExitAsync();
                }

                // WSL neustarten
                var wslProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "wsl",
                        Arguments = "--shutdown",
                        UseShellExecute = true
                    }
                };
                wslProcess.Start();
                await wslProcess.WaitForExitAsync();
                await Task.Delay(5000); // Warte 5 Sekunden für den Neustart
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