using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

public class DockerWslService
{
    public async Task ConfigureWsl()
    {
        try
        {
            // 1. WSL-Konfiguration zurücksetzen
            await RunPowershellCommand("wsl --shutdown");
            
            // 2. Docker Desktop neustarten
            await RunPowershellCommand(@"
                Stop-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
                Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
                Start-Sleep -Seconds 30  # Warte bis Docker Desktop hochgefahren ist
            ");

            // 3. Port-Forwarding einrichten
            var wslIp = await GetWslIp();
            var ports = new[] { 80, 4000, 1984, 8554 };
            
            foreach (var port in ports)
            {
                await RunPowershellCommand($@"
                    netsh interface portproxy delete v4tov4 listenport={port}
                    netsh interface portproxy add v4tov4 listenport={port} listenaddress=0.0.0.0 connectport={port} connectaddress={wslIp}
                ");
            }
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to configure WSL: {ex.Message}");
        }
    }

    private async Task RunPowershellCommand(string command)
    {
        var scriptPath = Path.Combine(Path.GetTempPath(), $"docker-wsl-{Guid.NewGuid()}.ps1");
        await File.WriteAllTextAsync(scriptPath, command);

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "powershell",
                Arguments = $"-WindowStyle Hidden -ExecutionPolicy Bypass -NonInteractive -File {scriptPath}",
                UseShellExecute = true,
                Verb = "runas",
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            }
        };
        process.Start();
        await process.WaitForExitAsync();
        File.Delete(scriptPath);
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
                RedirectStandardOutput = true,
                CreateNoWindow = true
            }
        };
        process.Start();
        var output = await process.StandardOutput.ReadToEndAsync();
        await process.WaitForExitAsync();
        return output.Trim().Split(' ')[0];
    }
} 