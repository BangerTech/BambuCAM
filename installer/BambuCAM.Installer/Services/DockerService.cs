using System;
using System.IO;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;

namespace BambuCAM.Installer.Services
{
    public class DockerService
    {
        public async Task<bool> IsDockerInstalled()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
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
            
            // Warte kurz, damit Docker Zeit hat zu starten
            await Task.Delay(TimeSpan.FromSeconds(30));
        }

        public async Task StartContainers()
        {
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker-compose",
                    Arguments = "up -d",
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