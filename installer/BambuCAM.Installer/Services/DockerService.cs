using System;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;

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
        // Download Docker Desktop
        var installerPath = Path.Combine(Path.GetTempPath(), "DockerDesktopInstaller.exe");
        using (var client = new HttpClient())
        {
            var response = await client.GetAsync("https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe");
            using (var fs = new FileStream(installerPath, FileMode.Create))
            {
                await response.Content.CopyToAsync(fs);
            }
        }

        // Install Docker Desktop
        var process = Process.Start(installerPath, "/quiet");
        await process.WaitForExitAsync();
    }
} 