using System;
using System.Diagnostics;
using System.Security.Principal;
using System.Windows;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        
        // Prüfe Admin-Rechte
        if (!IsRunAsAdministrator())
        {
            RestartAsAdmin();
            Shutdown();
            return;
        }
    }

    private bool IsRunAsAdministrator()
    {
        var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    private void RestartAsAdmin()
    {
        var startInfo = new ProcessStartInfo
        {
            UseShellExecute = true,
            FileName = Process.GetCurrentProcess().MainModule.FileName,
            Verb = "runas"
        };
        
        try
        {
            Process.Start(startInfo);
        }
        catch
        {
            MessageBox.Show("BambuCAM Setup requires administrator privileges.",
                          "Administrator Rights Required",
                          MessageBoxButton.OK,
                          MessageBoxImage.Warning);
        }
    }
} 