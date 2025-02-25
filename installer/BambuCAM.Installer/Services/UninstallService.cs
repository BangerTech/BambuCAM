using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace BambuCAM.Installer.Services
{
    public class UninstallService
    {
        private readonly DockerService _dockerService;

        public UninstallService(DockerService dockerService)
        {
            _dockerService = dockerService;
        }

        public async Task Uninstall()
        {
            // Stop and remove containers
            await _dockerService.StopContainers();
            
            // Remove installation directory
            var installDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "BambuCAM"
            );
            
            if (Directory.Exists(installDir))
            {
                Directory.Delete(installDir, true);
            }

            // Remove desktop shortcut
            var shortcutPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                "BambuCAM.lnk"
            );
            
            if (File.Exists(shortcutPath))
            {
                File.Delete(shortcutPath);
            }

            // Remove registry entries
            using var key = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                true
            );
            
            key?.DeleteSubKey("BambuCAM", false);
        }
    }
} 