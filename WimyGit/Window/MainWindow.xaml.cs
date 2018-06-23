using System.IO;
using System.Windows;
using System.Windows.Controls;

namespace WimyGit
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }

        private void AddTab(string path, bool is_focused)
        {
            TabItem tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader();
            tab_header.Path.Content = path;
            tab_header.Title.Content = Util.GetRepositoryName(path);
            tab_header.CloseButton.Click += (sender, e) =>
            {
                System.Diagnostics.Debug.WriteLine("close tab");
                tab_control_.Items.Remove(tab_item);
            };
            tab_item.Header = tab_header;
            tab_item.Content = new RepositoryTab(path);
            tab_item.Width = 200;

            tab_control_.Items.Insert(tab_control_.Items.Count - 1, tab_item);

            if (is_focused)
            {
                tab_item.Focus();
            }
        }

        private void RestoreTabs()
        {
            var tab_infos = LastTabInfo.Load();
            foreach (var tab_info in tab_infos)
            {
                AddTab(tab_info.Directory, tab_info.IsFocused);
            }
        }

        private void OnAddNewTabButtonClick(object sender, RoutedEventArgs e)
        {
            TabItem new_tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader();
            tab_header.Title.Content = "[[New Tab]]";
            tab_header.CloseButton.Click += (new_sender, new_event) =>
            {
                tab_control_.Items.Remove(new_tab_item);
            };
            new_tab_item.Header = tab_header;
            new_tab_item.Content = new UserControls.NewTab((repo_path) => {
                new_tab_item.Content = new RepositoryTab(repo_path);
                tab_header.Path.Content = repo_path;
                tab_header.Title.Content = Util.GetRepositoryName(repo_path);
            });
            new_tab_item.Width = 200;

            tab_control_.Items.Insert(tab_control_.Items.Count - 1, new_tab_item);

            new_tab_item.Focus();
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
            LastTabInfo.Save(tab_control_.Items);
        }
    }
}
