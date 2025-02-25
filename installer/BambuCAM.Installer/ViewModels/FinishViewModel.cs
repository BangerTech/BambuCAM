using System.Diagnostics;
using System.Windows.Input;

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
            Process.Start("http://localhost");
            CloseInstaller();
        }

        private void CloseInstaller()
        {
            App.Current.Shutdown();
        }
    }
} 