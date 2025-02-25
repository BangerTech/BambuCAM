using System;
using System.IO;
using IWshRuntimeLibrary;

namespace BambuCAM.Installer.Services
{
    public class ShortcutService
    {
        public void CreateDesktopShortcut(string targetPath, string shortcutName)
        {
            var shell = new WshShell();
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var shortcutPath = Path.Combine(desktopPath, $"{shortcutName}.lnk");

            var shortcut = (IWshShortcut)shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = targetPath;
            shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
            shortcut.Description = "BambuCAM - 3D Printer Monitor";
            shortcut.IconLocation = Path.Combine(Path.GetDirectoryName(targetPath), "Assets", "setup-icon.ico");
            shortcut.Save();
        }
    }
} 