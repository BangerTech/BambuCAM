using System;
using System.Linq;
using System.Net.Sockets;
using System.Threading.Tasks;
using System.Net;
using System.Diagnostics;
using System.IO;

public class NetworkService
{
    public async Task<bool> IsPortAvailable(int port)
    {
        try
        {
            using var tcpClient = new TcpClient();
            var result = await tcpClient.ConnectAsync("127.0.0.1", port)
                .WaitAsync(TimeSpan.FromSeconds(1))
                .ContinueWith(t => !t.IsFaulted);
            return !result;
        }
        catch
        {
            return true;
        }
    }

    public async Task CheckRequiredPorts()
    {
        var ports = new[] { 80, 1984, 4000 };
        var tasks = ports.Select(async port =>
        {
            if (!await IsPortAvailable(port))
            {
                throw new Exception($"Port {port} is already in use");
            }
        });
        
        await Task.WhenAll(tasks);
    }

    public static string GetLocalIPAddress()
    {
        var host = Dns.GetHostEntry(Dns.GetHostName());
        foreach (var ip in host.AddressList)
        {
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                return ip.ToString();
            }
        }
        return "localhost"; // Fallback
    }

    public async Task KillProcessOnPort(int port)
    {
        var script = $@"
            $processId = (Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue).OwningProcess
            if ($processId) {{
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {{
                    Write-Host ""Killing process $($process.ProcessName) ($processId) on port {port}""
                    Stop-Process -Id $processId -Force
                }}
            }}";

        var scriptPath = Path.Combine(Path.GetTempPath(), "kill-port.ps1");
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
    }
} 