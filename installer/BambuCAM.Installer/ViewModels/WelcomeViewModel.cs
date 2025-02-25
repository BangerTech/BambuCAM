using System.Windows.Input;
using BambuCAM.Installer.Services;
using BambuCAM.Installer.Views;
using BambuCAM.Installer.ViewModels.Commands;

namespace BambuCAM.Installer.ViewModels
{
    public class WelcomeViewModel : ViewModelBase
    {
        public WelcomeViewModel()
        {
            StartInstallCommand = new RelayCommand(StartInstallation);
        }

        public ICommand StartInstallCommand { get; }

        private void StartInstallation()
        {
            // Wechsel zur InstallationView
            NavigationService.Navigate(new InstallationView());
        }
    }
} 