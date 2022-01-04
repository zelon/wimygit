using System.Windows;
using System.Windows.Controls;

namespace WimyGit
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }

        private void AddTab(string path, bool is_focused)
        {
            TabItem tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader(tab_control_);
            tab_header.Path.Content = path;
            tab_header.Title.Content = Util.GetRepositoryName(path);
            tab_item.Header = tab_header;
            tab_item.Content = new RepositoryTab(path);

            tab_control_.Items.Insert(tab_control_.Items.Count - 1, tab_item);

            if (is_focused)
            {
                tab_item.Focus();
            }
        }

        private void RestoreTabs()
        {
            var tab_infos = GlobalSetting.GetInstance().ConfigModel.LastTabInfos;
            if (tab_infos.Count == 0)
            {
                AddNewTab();
            }
            else
            {
                foreach (var tab_info in tab_infos)
                {
                    AddTab(tab_info.Directory, tab_info.IsFocused);
                }
            }
        }

        private void OnMenuButtonClick(object sender, RoutedEventArgs e)
        {
            Button menuButton = (Button)sender;
            menuButton.ContextMenu.Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom;
            menuButton.ContextMenu.PlacementTarget = menuButton;
            menuButton.ContextMenu.IsOpen = true;
        }

        private void ShowPluginFolderInExplorer(object sender, RoutedEventArgs e)
        {
            string pluginRootDirectory = Plugin.PluginController.GetPluginRootDirectoryPath();
            RunExternal runner = new RunExternal("explorer.exe", pluginRootDirectory);
            runner.RunWithoutWaiting(pluginRootDirectory);
        }

        private void CloseWindow(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void OnAddNewTabButtonClick(object sender, RoutedEventArgs e)
        {
            AddNewTab();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            GlobalSetting.GetInstance().SetWindow(this);
            SetTitleToGitVersion();
            RestoreTabs();
        }

        private void SetTitleToGitVersion()
        {
            try
            {
                string output = ProgramPathFinder.ExecuteAndGetOutput(ProgramPathFinder.GetGitBin(),
                    "--version");
                this.Title += " - " + output;
            }
            catch (System.IO.FileNotFoundException ex)
            {
                UIService.ShowMessage(ex.Message);
                System.Environment.Exit(1);
            }
        }

        private void Window_Closed(object sender, System.EventArgs e)
        {
            GlobalSetting.GetInstance().ConfigModel.CollectTabInfo(tab_control_.Items);
            Config.ConfigFileController.Save(GlobalSetting.GetInstance().ConfigModel);
        }

        private void AddNewTab()
        {
            new NewRepositoryController(tab_control_).AddNewTab();
        }

        private void OnWindowDragOver(object sender, System.Windows.DragEventArgs e)
        {
            e.Effects = System.Windows.DragDropEffects.All;
        }

        private void OnWindowDragDrop(object sender, System.Windows.DragEventArgs e)
        {
            string[] paths = (string[])e.Data.GetData(System.Windows.DataFormats.FileDrop);

            if (paths.Length != 1)
            {
                UIService.ShowMessage("Please drop one directory only");
                return;
            }
            string repository_path = paths[0];
            if (Util.IsValidGitDirectory(repository_path) == false)
            {
                if (UIService.AskAndGitInit(repository_path) == false)
                {
                    return;
                }
            }
            new NewRepositoryController(tab_control_).OpenRepository(repository_path);
        }
    }
}
