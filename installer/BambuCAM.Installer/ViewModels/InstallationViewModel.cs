using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using BambuCAM.Installer.Models;
using BambuCAM.Installer.Services;
using BambuCAM.Installer.Views;

namespace BambuCAM.Installer.ViewModels
{
    public class InstallationViewModel : ViewModelBase
    {
        private readonly InstallationService _installService;
        private int _progress;
        private string _statusMessage;
        private string _detailMessage;
        private bool _isInstalling;
        private ObservableCollection<string> _logMessages;

        public InstallationViewModel()
        {
            _installService = new InstallationService();
            _logMessages = new ObservableCollection<string>();
            _ = StartInstallation();
        }

        public int Progress
        {
            get => _progress;
            set => SetProperty(ref _progress, value);
        }

        public string StatusMessage
        {
            get => _statusMessage;
            set
            {
                if (SetProperty(ref _statusMessage, value))
                {
                    LogMessages.Add($"[{DateTime.Now:HH:mm:ss}] {value}");
                }
            }
        }

        public string DetailMessage
        {
            get => _detailMessage;
            set => SetProperty(ref _detailMessage, value);
        }

        public ObservableCollection<string> LogMessages
        {
            get => _logMessages;
            set => SetProperty(ref _logMessages, value);
        }

        private async Task StartInstallation()
        {
            try
            {
                var progress = new Progress<InstallationStatus>(status =>
                {
                    Progress = status.Progress;
                    StatusMessage = status.Message;
                    DetailMessage = status.DetailedMessage;
                });

                var result = await _installService.Install(progress);
                if (result.Success)
                {
                    NavigationService.Navigate(new FinishView());
                }
                else
                {
                    DetailMessage = result.ErrorMessage;
                }
            }
            catch (Exception ex)
            {
                DetailMessage = $"Installation failed: {ex.Message}";
            }
        }
    }
} 