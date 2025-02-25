using System.Windows.Controls;
using BambuCAM.Installer.ViewModels;

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