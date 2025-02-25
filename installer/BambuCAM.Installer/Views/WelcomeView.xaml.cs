using System.Windows.Controls;

namespace BambuCAM.Installer.Views
{
    public partial class WelcomeView : UserControl
    {
        public WelcomeView()
        {
            InitializeComponent();
            DataContext = new WelcomeViewModel();
        }
    }
} 