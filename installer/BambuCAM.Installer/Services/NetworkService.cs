using System;
using System.Linq;
using System.Net.Sockets;
using System.Threading.Tasks;
using System.Net;

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
} 