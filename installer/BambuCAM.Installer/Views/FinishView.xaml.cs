using System.Windows.Controls;
using BambuCAM.Installer.ViewModels;

namespace BambuCAM.Installer.Views
{
    public partial class FinishView : UserControl
    {
        public FinishView()
        {
            InitializeComponent();
            DataContext = new FinishViewModel();
        }
    }
} 