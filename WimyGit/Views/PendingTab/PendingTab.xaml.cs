using System.Linq;
using System.Threading.Tasks;
using System.Windows.Controls;
using WimyGitLib;

namespace WimyGit.UserControls
{
    public partial class PendingTab : UserControl
    {
        public PendingTab()
        {
            InitializeComponent();

            PendingTabViewModel pendingTabViewModel = (PendingTabViewModel)DataContext;
            pendingTabViewModel.OnSelectAllCallbackViewSide = () => unstagedFileListBox.SelectAll();

            unstagedFileListBox.ContextMenuOpening += (sender, e) =>
            {
                const string headerName = "Add folder to .gitignore";
                ContextMenu contextMenu = unstagedFileListBox.ContextMenu;

                // Only add .gitignore menu when exactly one file is selected
                if (pendingTabViewModel.SelectedModifiedFilePathList.Count() == 1)
                {
                    MenuItem addToIgnoreMenu = null;
                    foreach (var item in contextMenu.Items.OfType<MenuItem>().ToList())
                    {
                        if ((string)(item.Header) == headerName)
                        {
                            addToIgnoreMenu = item;
                            break;
                        }
                    }
                    if (addToIgnoreMenu == null)
                    {
                        addToIgnoreMenu = new MenuItem { Header = headerName };
                        contextMenu.Items.Add(addToIgnoreMenu);
                    }
                    addToIgnoreMenu.Items.Clear();

                    System.Collections.Generic.HashSet<string> folderSet = new System.Collections.Generic.HashSet<string>();
                    foreach (var filePath in pendingTabViewModel.SelectedModifiedFilePathList)
                    {
                        // Split the file path by directory separator and reconstruct folder paths step by step
                        string[] pathParts = filePath.Split("/");
                        string currentPath = string.Empty;

                        foreach (var part in pathParts.Take(pathParts.Length))
                        {
                            currentPath = string.IsNullOrEmpty(currentPath) ? part : (currentPath + "/" + part);
                            folderSet.Add(currentPath);
                        }
                    }

                    foreach (var folder in folderSet.Reverse())
                    {
                        MenuItem folderMenuItem = new MenuItem { Header = $"Add \"{folder}\" to .gitignore" };
                        folderMenuItem.Click += (s, args) =>
                        {
                            var gitRepository = pendingTabViewModel.GetGitRepository();
                            if (gitRepository == null)
                            {
                                return;
                            }
                            GitIgnore.AddToGitIgnore(gitRepository.GetRepositoryDirectory(), folder);
                            gitRepository.Refresh();
                        };
                        addToIgnoreMenu.Items.Add(folderMenuItem);
                    }
                }
                else
                {
                    // Remove .gitignore menu when multiple files are selected
                    foreach (var item in contextMenu.Items.OfType<MenuItem>().ToList())
                    {
                        if ((string)(item.Header) == headerName)
                        {
                            contextMenu.Items.Remove(item);
                            break;
                        }
                    }
                }
            };
        }

        private void RefreshQuickViewFromStagedFiles()
        {
            PendingTabViewModel pendingTabViewModel = (PendingTabViewModel)DataContext;
            pendingTabViewModel.OnStagedFilesSelectionChanged();
        }

        private void RefreshQuickViewFromUnstagedFiles()
        {
            PendingTabViewModel pendingTabViewModel = (PendingTabViewModel)DataContext;
            pendingTabViewModel.OnUnstagedFilesSelectionChanged();
        }

        private void OnStagedFileListBox_GotFocus(object sender, System.Windows.RoutedEventArgs e)
        {
            RefreshQuickViewFromStagedFiles();
        }

        private void OnStagedFileListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            RefreshQuickViewFromStagedFiles();
        }

        private void OnUnstagedFileListBox_GotFocus(object sender, System.Windows.RoutedEventArgs e)
        {
            RefreshQuickViewFromUnstagedFiles();
        }

        private void OnUnstagedFileListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            RefreshQuickViewFromUnstagedFiles();
        }
    }
}
