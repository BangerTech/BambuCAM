using System.Windows.Controls;

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