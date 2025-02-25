namespace BambuCAM.Installer.Models
{
    public class InstallationStatus
    {
        public int Progress { get; set; }
        public string Message { get; set; }
        public string DetailedMessage { get; set; }

        public InstallationStatus(int progress, string message, string detailedMessage = null)
        {
            Progress = progress;
            Message = message;
            DetailedMessage = detailedMessage;
        }
    }
} 