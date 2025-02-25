using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO.Compression;
using BambuCAM.Installer.Models;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Linq;

namespace BambuCAM.Installer.Services
{
    public class DownloadService
    {
        private readonly string _installDir;
        private readonly HttpClient _client;

        public DownloadService()
        {
            _installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BambuCAM"
            );
            _client = new HttpClient();
            // GitHub API Headers
            _client.DefaultRequestHeaders.Add("User-Agent", "BambuCAM-Installer");
            // Optional: Füge einen GitHub Token hinzu für höhere Rate Limits
            // _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "YOUR_TOKEN");
        }

        public string InstallDir => _installDir;

        public async Task DownloadAndExtract(IProgress<InstallationStatus> progress)
        {
            try
            {
                // Get latest release info
                progress.Report(new InstallationStatus(0, "Checking latest version..."));
                var releaseInfo = await GetLatestRelease();
                
                // Download ZIP
                var zipPath = Path.Combine(Path.GetTempPath(), "BambuCAM.zip");
                await DownloadFile(releaseInfo.DownloadUrl, zipPath, progress);

                // Extract
                progress.Report(new InstallationStatus(95, "Extracting files...", "This might take a minute"));
                Directory.CreateDirectory(_installDir);
                Directory.CreateDirectory(Path.Combine(_installDir, "backend", "data", "go2rtc"));

                // Extrahiere das ZIP
                using (var archive = ZipFile.OpenRead(zipPath))
                {
                    // Debug: Zeige alle Dateien im ZIP
                    Console.WriteLine("Files in ZIP:");
                    foreach (var entry in archive.Entries)
                    {
                        Console.WriteLine($"- {entry.FullName}");
                    }

                    // Der erste Eintrag ist normalerweise der Hauptordner
                    var rootFolder = archive.Entries[0].FullName;
                    Console.WriteLine($"Root folder: {rootFolder}");

                    // Suche nach docker-compose.yml (nicht mehr .prod)
                    var composeEntry = archive.Entries.FirstOrDefault(e => 
                        e.FullName.EndsWith("docker-compose.yml", StringComparison.OrdinalIgnoreCase));

                    if (composeEntry == null)
                    {
                        throw new Exception("docker-compose.yml not found in downloaded ZIP");
                    }

                    // Extrahiere docker-compose.yml direkt ins Zielverzeichnis
                    composeEntry.ExtractToFile(Path.Combine(_installDir, "docker-compose.yml"), true);

                    // Erstelle benötigte Verzeichnisse
                    Directory.CreateDirectory(Path.Combine(_installDir, "backend", "data"));
                    Directory.CreateDirectory(Path.Combine(_installDir, "backend", "data", "go2rtc"));
                }

                // Cleanup
                File.Delete(zipPath);

                // Debug: Zeige extrahierte Dateien
                Console.WriteLine("\nFiles in install directory:");
                foreach (var file in Directory.GetFiles(_installDir, "*.*", SearchOption.AllDirectories))
                {
                    Console.WriteLine($"- {file}");
                }

                // Nach dem Extrahieren der docker-compose.yml
                var prodComposeContent = @"version: '3'

services:
  frontend:
    image: bangertech/bambucam-frontend:latest
    restart: unless-stopped
    network_mode: 'host'

  backend:
    image: bangertech/bambucam-backend:latest
    restart: unless-stopped
    volumes:
      - bambucam_data:/app/data
      - bambucam_logs:/app/logs
    network_mode: 'host'

  go2rtc:
    image: alexxit/go2rtc
    container_name: go2rtc
    restart: unless-stopped
    network_mode: host
    volumes:
      - bambucam_go2rtc:/config
    environment:
      - GO2RTC_CONFIG=/config/go2rtc.yaml
      - GO2RTC_API=listen=:1984
      - GO2RTC_API_BASE=/go2rtc

volumes:
  bambucam_logs:
  bambucam_data:
  bambucam_go2rtc:";

                // Schreibe die Production docker-compose.yml
                await File.WriteAllTextAsync(Path.Combine(_installDir, "docker-compose.yml"), prodComposeContent);
            }
            catch (Exception ex)
            {
                throw new Exception($"Download failed: {ex.Message}", ex);
            }
        }

        private async Task<ReleaseInfo> GetLatestRelease()
        {
            try
            {
                // Versuche zuerst den neuesten Release zu bekommen
                try
                {
                    var response = await _client.GetFromJsonAsync<GitHubRelease>(
                        "https://api.github.com/repos/BangerTech/BambuCAM/releases/latest"
                    );
                    
                    if (response != null)
                    {
                        return new ReleaseInfo 
                        { 
                            TagName = response.TagName,
                            DownloadUrl = response.ZipballUrl
                        };
                    }
                }
                catch
                {
                    // Wenn kein Release gefunden wurde, ignoriere den Fehler und nutze main.zip
                }

                // Fallback: Wenn kein Release existiert, nutze den main branch
                return new ReleaseInfo 
                { 
                    TagName = "development",
                    DownloadUrl = "https://github.com/BangerTech/BambuCAM/archive/refs/heads/main.zip"
                };
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to get release info. Please check your internet connection.", ex);
            }
        }

        private async Task DownloadFile(string url, string path, IProgress<InstallationStatus> progress)
        {
            using var response = await _client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();
            
            var totalBytes = response.Content.Headers.ContentLength ?? -1L;
            var totalMB = totalBytes / 1024.0 / 1024.0;
            
            using var fileStream = File.Create(path);
            using var downloadStream = await response.Content.ReadAsStreamAsync();
            
            var buffer = new byte[81920]; // Größerer Buffer für schnelleres Downloaden
            var bytesRead = 0L;
            var startTime = DateTime.Now;
            
            while (true)
            {
                var read = await downloadStream.ReadAsync(buffer);
                if (read == 0) break;
                
                await fileStream.WriteAsync(buffer.AsMemory(0, read));
                bytesRead += read;

                if (totalBytes != -1)
                {
                    var percent = (int)((bytesRead * 100) / totalBytes);
                    var downloadedMB = bytesRead / 1024.0 / 1024.0;
                    var elapsed = DateTime.Now - startTime;
                    var speed = downloadedMB / elapsed.TotalSeconds;
                    var remaining = TimeSpan.FromSeconds((totalMB - downloadedMB) / speed);

                    progress.Report(new InstallationStatus(
                        percent, 
                        $"Downloading BambuCAM... {percent}%",
                        $"Downloaded: {downloadedMB:F1} MB of {totalMB:F1} MB\n" +
                        $"Speed: {speed:F1} MB/s\n" +
                        $"Time remaining: {remaining:mm\\:ss}"
                    ));
                }
            }
        }
    }

    public class ReleaseInfo
    {
        public string TagName { get; set; }
        public string DownloadUrl { get; set; }
    }

    // Klasse für die GitHub API Response (private entfernt)
    internal class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string TagName { get; set; }
        
        [JsonPropertyName("zipball_url")]
        public string ZipballUrl { get; set; }
    }
} 