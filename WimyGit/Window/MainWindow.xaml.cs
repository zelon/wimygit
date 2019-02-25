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
            var tab_infos = Service.GetInstance().ConfigModel.LastTabInfos;
            if (tab_infos.Count == 0)
            {
                AddNewTab();
            }
            else
            {
                foreach (var tab_info in tab_infos)
                {
					if (Util.IsValidGitDirectory(tab_info.Directory) == false)
					{
						continue;
					}
                    AddTab(tab_info.Directory, tab_info.IsFocused);
                }
            }
        }

        private void OnAddNewTabButtonClick(object sender, RoutedEventArgs e)
        {
            AddNewTab();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            Service.GetInstance().SetWindow(this);
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
                Service.GetInstance().ShowMsg(ex.Message);
                System.Environment.Exit(1);
            }
        }

        private void Window_Closed(object sender, System.EventArgs e)
        {
            Service.GetInstance().ConfigModel.CollectTabInfo(tab_control_.Items);
            Config.ConfigFileController.Save(Service.GetInstance().ConfigModel);
        }

        private void AddNewTab()
        {
            TabItem new_tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader(tab_control_);
            tab_header.Title.Content = "[[New Tab]]";
            new_tab_item.Header = tab_header;
            new_tab_item.Content = new UserControls.NewTab((repo_path) => {
				if (Util.IsValidGitDirectory(repo_path) == false)
				{
					Service.GetInstance().ShowMsg("Invalid git root directory");
					return;
				}
				new_tab_item.Content = new RepositoryTab(repo_path);
                tab_header.Path.Content = repo_path;
                tab_header.Title.Content = Util.GetRepositoryName(repo_path);
            });

            tab_control_.Items.Insert(tab_control_.Items.Count - 1, new_tab_item);

            new_tab_item.Focus();
        }

        private void OnAddTabButtonDragOver(object sender, System.Windows.DragEventArgs e)
        {
            e.Effects = System.Windows.DragDropEffects.All;
        }

        private void OnAddTabButtonDrawDrop(object sender, System.Windows.DragEventArgs e)
        {
            string[] paths = (string[])e.Data.GetData(System.Windows.DataFormats.FileDrop);

            if (paths.Length != 1)
            {
                Service.GetInstance().ShowMsg("Please drop one directory only");
                return;
            }
            string repository_path = paths[0];
            if (Util.IsValidGitDirectory(repository_path) == false)
            {
                Service.GetInstance().ShowMsg(string.Format("Invalid git root directory:{0}", repository_path));
                return;
            }

            TabItem new_tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader(tab_control_);
            tab_header.Title.Content = "[[New Tab]]";
            tab_header.Path.Content = repository_path;
            tab_header.Title.Content = Util.GetRepositoryName(repository_path);
            new_tab_item.Header = tab_header;
            new_tab_item.Content = new RepositoryTab(repository_path);

            tab_control_.Items.Insert(tab_control_.Items.Count - 1, new_tab_item);

            new_tab_item.Focus();
        }
    }
}
