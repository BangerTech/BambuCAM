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
    public class MainViewModel : INotifyPropertyChanged
    {
        private readonly InstallationService _installationService;
        private readonly Progress<InstallationStatus> _progress;
        
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
        
        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
        
        // Properties...
    }
} 