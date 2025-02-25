using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.IO.Compression;
using BambuCAM.Installer.Models;
using System.Net.Http.Json;

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
        }

        public string InstallDir => _installDir;

        public async Task DownloadAndExtract(IProgress<InstallationStatus> progress)
        {
            // Get latest release info
            var releaseInfo = await GetLatestRelease();
            
            // Download ZIP
            var zipPath = Path.Combine(Path.GetTempPath(), "BambuCAM.zip");
            await DownloadFile(releaseInfo.DownloadUrl, zipPath, progress);

            // Extract
            Directory.CreateDirectory(_installDir);
            ZipFile.ExtractToDirectory(zipPath, _installDir, true);

            // Cleanup
            File.Delete(zipPath);
        }

        private async Task<ReleaseInfo> GetLatestRelease()
        {
            var response = await _client.GetFromJsonAsync<ReleaseInfo>(
                "https://api.github.com/repos/BangerTech/BambuCAM/releases/latest"
            );
            return response;
        }

        private async Task DownloadFile(string url, string path, IProgress<InstallationStatus> progress)
        {
            using var response = await _client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
            var totalBytes = response.Content.Headers.ContentLength ?? -1L;
            
            using var fileStream = File.Create(path);
            using var downloadStream = await response.Content.ReadAsStreamAsync();
            
            var buffer = new byte[8192];
            var bytesRead = 0L;
            
            while (true)
            {
                var read = await downloadStream.ReadAsync(buffer);
                if (read == 0) break;
                
                await fileStream.WriteAsync(buffer.AsMemory(0, read));
                bytesRead += read;

                if (totalBytes != -1)
                {
                    var percent = (int)((bytesRead * 100) / totalBytes);
                    progress.Report(new InstallationStatus(
                        percent, 
                        $"Downloading BambuCAM... {percent}%"
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
} 