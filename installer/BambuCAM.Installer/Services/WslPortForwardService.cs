using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

public class WslPortForwardService
{
    public async Task StartPortForwarding()
    {
        try
        {
            var wslIp = await GetWslIp();
            if (string.IsNullOrEmpty(wslIp))
            {
                throw new Exception("Could not determine WSL IP address");
            }

            var script = $@"
                $ports = @(80, 4000, 1984, 8554)
                foreach ($port in $ports) {{
                    netsh interface portproxy delete v4tov4 listenport=$port
                    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress={wslIp}
                }}";

            var scriptPath = Path.Combine(Path.GetTempPath(), "port-forward.ps1");
            await File.WriteAllTextAsync(scriptPath, script);

            var process = new Process
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
            process.Start();
            await process.WaitForExitAsync();
            File.Delete(scriptPath);
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to setup port forwarding: {ex.Message}");
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