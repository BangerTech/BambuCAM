using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading.Tasks;
using System.Windows.Input;
using BambuCAM.Installer.Models;
using BambuCAM.Installer.Services;
using BambuCAM.Installer.ViewModels.Commands;

namespace BambuCAM.Installer.ViewModels
{
    public class MainViewModel : ViewModelBase
    {
        private readonly InstallationService _installationService;
        private readonly Progress<InstallationStatus> _progress;
        private int _currentProgress;
        private string _statusMessage;
        private string _detailedMessage;
        private bool _isInstalling;
        private bool _isCompleted;
        private string _errorMessage;
        
        public MainViewModel()
        {
            _installationService = new InstallationService();
            _progress = new Progress<InstallationStatus>(status =>
            {
                CurrentProgress = status.Progress;
                StatusMessage = status.Message;
                DetailedMessage = status.DetailedMessage;
            });
            
            InstallCommand = new RelayCommand(async () => await Install());
        }
        
        public ICommand InstallCommand { get; }
        
        private async Task Install()
        {
            IsInstalling = true;
            try
            {
                await _installationService.Install(_progress);
                IsCompleted = true;
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
            }
            finally
            {
                IsInstalling = false;
            }
        }
        
        public int CurrentProgress
        {
            get => _currentProgress;
            set => SetProperty(ref _currentProgress, value);
        }

        public string StatusMessage
        {
            get => _statusMessage;
            set => SetProperty(ref _statusMessage, value);
        }

        public string DetailedMessage
        {
            get => _detailedMessage;
            set => SetProperty(ref _detailedMessage, value);
        }

        public bool IsInstalling
        {
            get => _isInstalling;
            set => SetProperty(ref _isInstalling, value);
        }

        public bool IsCompleted
        {
            get => _isCompleted;
            set => SetProperty(ref _isCompleted, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            set => SetProperty(ref _errorMessage, value);
        }
    }
} 