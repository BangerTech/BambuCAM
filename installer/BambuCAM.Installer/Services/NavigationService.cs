using System.Windows.Controls;

namespace BambuCAM.Installer.Services
{
    public static class NavigationService
    {
        private static ContentControl _mainContent;

        public static void Initialize(ContentControl mainContent)
        {
            _mainContent = mainContent;
        }

        public static void Navigate(UserControl view)
        {
            _mainContent.Content = view;
        }
    }
} 