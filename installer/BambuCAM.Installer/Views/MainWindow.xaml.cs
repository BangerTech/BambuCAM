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