using System.Windows.Controls;
using BambuCAM.Installer.ViewModels;

namespace BambuCAM.Installer.Views
{
    public partial class InstallationView : UserControl
    {
        public InstallationView()
        {
            InitializeComponent();
            DataContext = new InstallationViewModel();
        }
    }
} 