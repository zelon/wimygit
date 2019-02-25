using System.Diagnostics;
using System.Windows.Controls;

namespace WimyGit
{
    class NewRepositoryController
    {
        private TabControl tabControl_;

        public NewRepositoryController(TabControl tabControl)
        {
            tabControl_ = tabControl;
        }

        public void AddNewTab()
        {
            Execute(null);
        }

        public void OpenRepository(string path)
        {
            Debug.Assert(string.IsNullOrEmpty(path) == false);
            Execute(path);
        }

        private void Execute(string path)
        {
            TabItem new_tab_item = new TabItem();
            var tab_header = new UserControls.RepositoryTabHeader(tabControl_);
            tab_header.SetRepositoryPath(path);
            new_tab_item.Header = tab_header;
            if (path == null)
            {
                new_tab_item.Content = new UserControls.NewTab((repo_path) => {
                    Debug.Assert(Util.IsValidGitDirectory(repo_path));
                    new_tab_item.Content = new RepositoryTab(repo_path);
                    tab_header.SetRepositoryPath(repo_path);
                });
            }
            else
            {
                Debug.Assert(Util.IsValidGitDirectory(path));
                new_tab_item.Content = new RepositoryTab(path);
            }

            tabControl_.Items.Insert(tabControl_.Items.Count - 1, new_tab_item);

            new_tab_item.Focus();
        }
    }
}
