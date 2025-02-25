using System.Windows;
using System.Windows.Controls;
using BambuCAM.Installer.Services;
using BambuCAM.Installer.Views;

namespace BambuCAM.Installer.Views
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            NavigationService.Initialize(MainContent);
            NavigationService.Navigate(new WelcomeView());
        }
    }
} 