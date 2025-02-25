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

        public InstallationService()
        {
            _dockerService = new DockerService();
            _networkService = new NetworkService();
            _downloadService = new DownloadService();
            _shortcutService = new ShortcutService();
        }

        public async Task<InstallationProgress> Install(
            IProgress<InstallationStatus> progress,
            bool createShortcut = true)
        {
            try
            {
                // Check Docker (25%)
                progress.Report(new InstallationStatus(0, "Checking Docker installation..."));
                if (!await _dockerService.IsDockerInstalled())
                {
                    progress.Report(new InstallationStatus(10, "Installing Docker..."));
                    await _dockerService.InstallDocker();
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
                progress.Report(new InstallationStatus(85, "Waiting for services..."));
                await WaitForServices();

                // Create shortcut if requested
                if (createShortcut)
                {
                    progress.Report(new InstallationStatus(95, "Creating desktop shortcut..."));
                    _shortcutService.CreateDesktopShortcut(
                        Path.Combine(_downloadService.InstallDir, "BambuCAM.exe"),
                        "BambuCAM"
                    );
                }

                // Complete
                progress.Report(new InstallationStatus(100, "Installation completed successfully!"));
                return InstallationProgress.Successful;
            }
            catch (Exception ex)
            {
                return InstallationProgress.Failure(ex.Message);
            }
        }

        private async Task WaitForServices()
        {
            using var client = new HttpClient();
            var endpoints = new[]
            {
                "http://localhost",
                "http://localhost:4000/api/health",
                "http://localhost:1984/api/status"
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
                        if (retries == 0) throw;
                        await Task.Delay(1000);
                    }
                }
            }
        }
    }
} 