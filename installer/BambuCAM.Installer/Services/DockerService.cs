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
        public bool IsDockerInstalled()
        {
            try
            {
                var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                var dockerPath = Path.Combine(programFiles, "Docker", "Docker", "Docker Desktop.exe");
                return File.Exists(dockerPath);
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
            // Stelle sicher, dass Docker installiert ist
            if (!IsDockerInstalled())
            {
                throw new Exception("Docker is not installed. Please install Docker Desktop first.");
            }

            // Starte Docker Desktop falls nicht aktiv
            var dockerRunning = await CheckDockerRunning();
            if (!dockerRunning)
            {
                await StartDockerDesktop();
            }

            var installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BambuCAM"
            );

            // Prüfe ob docker-compose.yml existiert
            var composeFile = Path.Combine(installDir, "docker-compose.yml");
            if (!File.Exists(composeFile))
            {
                throw new Exception("docker-compose.yml not found. Please ensure BambuCAM was downloaded correctly.");
            }

            // Mehrere Versuche für das Starten der Container
            var retries = 5;
            var delay = 5000;

            while (retries-- > 0)
            {
                try
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = "docker",
                            Arguments = "compose up -d",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true,
                            WorkingDirectory = installDir
                        }
                    };

                    var output = new System.Text.StringBuilder();
                    var error = new System.Text.StringBuilder();

                    process.OutputDataReceived += (s, e) => { if (e.Data != null) output.AppendLine(e.Data); };
                    process.ErrorDataReceived += (s, e) => { if (e.Data != null) error.AppendLine(e.Data); };
                    
                    process.Start();
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    await process.WaitForExitAsync();

                    if (process.ExitCode == 0)
                    {
                        return; // Erfolgreich!
                    }

                    if (retries == 0)
                    {
                        throw new Exception($"Failed to start Docker containers.\nError: {error}\nOutput: {output}");
                    }

                    await Task.Delay(delay);
                }
                catch (Exception ex)
                {
                    if (retries == 0)
                    {
                        throw new Exception($"Failed to start Docker containers: {ex.Message}");
                    }
                    await Task.Delay(delay);
                }
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
                    FileName = "docker",
                    Arguments = "compose down",
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