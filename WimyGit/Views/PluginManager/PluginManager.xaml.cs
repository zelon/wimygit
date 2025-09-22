using System.Windows;

namespace WimyGit.Views
{
    public partial class PluginManager : Window
    {
        public PluginManager()
        {
            InitializeComponent();
            PluginManagerViewModel viewModel = new PluginManagerViewModel();
            this.DataContext = viewModel;
        }
    }
}
