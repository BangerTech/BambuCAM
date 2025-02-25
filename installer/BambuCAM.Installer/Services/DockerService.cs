using System;
using System.IO;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;
using System.Runtime.InteropServices;

namespace BambuCAM.Installer.Services
{
    public class DockerService
    {
        public async Task<bool> IsDockerInstalled()
        {
            try
            {
                // Prüfe ob Docker Desktop installiert ist
                var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                var dockerPath = Path.Combine(programFiles, "Docker", "Docker", "Docker Desktop.exe");
                if (!File.Exists(dockerPath))
                {
                    return false;
                }

                // Prüfe ob Docker läuft
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = "info",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                try
                {
                    process.Start();
                    await process.WaitForExitAsync();
                    return process.ExitCode == 0;
                }
                catch
                {
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        public async Task StartDockerDesktop()
        {
            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var dockerPath = Path.Combine(programFiles, "Docker", "Docker", "Docker Desktop.exe");
            
            if (File.Exists(dockerPath))
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = dockerPath,
                        UseShellExecute = true
                    }
                };
                
                process.Start();
                // Warte bis Docker bereit ist
                await WaitForDockerReady();
            }
        }

        private async Task WaitForDockerReady()
        {
            var retries = 60; // 2 Minuten Timeout
            while (retries-- > 0)
            {
                try
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "docker",
                            Arguments = "info",
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            UseShellExecute = false,
                            CreateNoWindow = true
                        }
                    };
                    
                    process.Start();
                    await process.WaitForExitAsync();
                    if (process.ExitCode == 0) return;
                }
                catch
                {
                    // Ignoriere Fehler und versuche es weiter
                }
                await Task.Delay(2000); // Warte 2 Sekunden zwischen Versuchen
            }
            throw new Exception("Docker Desktop did not start properly. Please try starting it manually.");
        }

        public async Task InstallDocker()
        {
            var installerPath = Path.Combine(Path.GetTempPath(), "DockerDesktopInstaller.exe");
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync("https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe");
                using (var fs = new FileStream(installerPath, FileMode.Create))
                {
                    await response.Content.CopyToAsync(fs);
                }
            }

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = installerPath,
                    Arguments = "install --quiet",
                    UseShellExecute = true,
                    Verb = "runas" // Run as administrator
                }
            };
            
            process.Start();
            await process.WaitForExitAsync();
            
            // Starte Docker Desktop
            await StartDockerDesktop();
        }

        public async Task StartContainers()
        {
            // Stelle sicher, dass Docker läuft
            if (!await IsDockerInstalled())
            {
                throw new Exception("Docker is not installed. Please install Docker Desktop first.");
            }

            // Starte Docker Desktop falls nicht aktiv
            var dockerRunning = await CheckDockerRunning();
            if (!dockerRunning)
            {
                await StartDockerDesktop();
            }

            // Kopiere docker-compose.yml wenn nötig
            var installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BambuCAM"
            );
            
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker-compose",
                    Arguments = "up -d",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                    WorkingDirectory = installDir
                }
            };
            
            process.Start();
            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                throw new Exception("Failed to start Docker containers. Please check if Docker Desktop is running.");
            }
        }

        public async Task<bool> CheckDockerRunning()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = "info",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                
                process.Start();
                await process.WaitForExitAsync();
                return process.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }

        public async Task StopContainers()
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker-compose",
                    Arguments = "down",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "BambuCAM"
                    )
                }
            };
            
            process.Start();
            await process.WaitForExitAsync();
        }
    }
} 