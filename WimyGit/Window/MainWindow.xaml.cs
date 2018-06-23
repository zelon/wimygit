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

            RestoreTabs();
            AddPlusTabButton();
        }

        private void AddTab(string path)
        {
            TabItem tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader();
            tab_header.Title.Content = Util.GetRepositoryName(path);
            tab_header.CloseButton.Click += (sender, e) =>
            {
                System.Diagnostics.Debug.WriteLine("close tab");
                tab_control_.Items.Remove(tab_item);
            };
            tab_item.Header = tab_header;
            tab_item.Content = new RepositoryTab(path);
            tab_item.Width = 200;

            tab_control_.Items.Insert(0, tab_item);
        }

        private void RestoreTabs()
        {
            int count = 0;
            foreach (var path in Service.GetInstance().recent_repository_.GetList())
            {
                AddTab(path);

                ++count;
                if (count == 3)
                {
                    break;
                }
            }
        }

        private void AddPlusTabButton()
        {
            var button = new Button();
            button.Width = 50;
            button.Content = "+";
            button.Click += (sender, e) => {
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
                    tab_header.Title.Content = Util.GetRepositoryName(repo_path);
                });
                new_tab_item.Width = 200;

                tab_control_.Items.Insert(tab_control_.Items.Count - 1, new_tab_item);

                new_tab_item.Focus();
            };

            TabItem tab_item = new TabItem();
            tab_item.Header = button;
            tab_item.Width = button.Width + 12;
            tab_item.Focusable = false;
            tab_control_.Items.Insert(tab_control_.Items.Count, tab_item);
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            Service.GetInstance().SetWindow(this);
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
    }
}
