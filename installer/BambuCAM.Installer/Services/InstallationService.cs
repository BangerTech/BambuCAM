using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO;
using BambuCAM.Installer.Models;

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
    }
} 