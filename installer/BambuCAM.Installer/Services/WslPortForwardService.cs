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
                # Verstecke PowerShell-Fenster
                $WindowStyle = 'Hidden'
                $Host.UI.RawUI.WindowTitle = 'BambuCAM Port Setup'
                
                # Kill processes using our ports
                $ports = @(80, 4000, 1984, 8554)
                foreach ($port in $ports) {{
                    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                        Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {{
                        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
                    }}
                }}

                # Setup port forwarding (silent)
                foreach ($port in $ports) {{
                    netsh interface portproxy delete v4tov4 listenport=$port | Out-Null
                    netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress={wslIp} | Out-Null
                }}";

            var scriptPath = Path.Combine(Path.GetTempPath(), "port-forward.ps1");
            await File.WriteAllTextAsync(scriptPath, script);

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

            await Task.Delay(2000);
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