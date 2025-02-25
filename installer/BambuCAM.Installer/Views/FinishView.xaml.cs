using System.Windows.Controls;

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