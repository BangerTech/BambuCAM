using System;
using System.IO;
using System.Runtime.InteropServices;

namespace BambuCAM.Installer.Services
{
    public class ShortcutService
    {
        public void CreateDesktopShortcut(string targetUrl, string shortcutName)
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var shortcutPath = Path.Combine(desktopPath, $"{shortcutName}.url");

            using (StreamWriter writer = new StreamWriter(shortcutPath))
            {
                writer.WriteLine("[InternetShortcut]");
                writer.WriteLine($"URL={targetUrl}");
                writer.WriteLine("IconIndex=0");
                writer.WriteLine($"IconFile={Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "setup-icon.ico")}");
            }
        }
    }
} 