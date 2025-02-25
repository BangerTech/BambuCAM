using System.Diagnostics;
using System.Windows.Input;
using System.Runtime.InteropServices;

namespace BambuCAM.Installer.ViewModels
{
    public class FinishViewModel : ViewModelBase
    {
        public FinishViewModel()
        {
            LaunchCommand = new RelayCommand(LaunchApplication);
            CloseCommand = new RelayCommand(CloseInstaller);
        }

        public ICommand LaunchCommand { get; }
        public ICommand CloseCommand { get; }

        private void LaunchApplication()
        {
            var url = "http://localhost";
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            CloseInstaller();
        }

        private void CloseInstaller()
        {
            App.Current.Shutdown();
        }
    }
} 