using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO.Compression;
using BambuCAM.Installer.Models;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

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
                ZipFile.ExtractToDirectory(zipPath, _installDir, true);

                // Cleanup
                File.Delete(zipPath);
            }
            catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                throw new Exception("GitHub API rate limit exceeded. Please try again in a few minutes.", ex);
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