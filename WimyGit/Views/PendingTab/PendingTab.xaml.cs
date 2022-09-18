using System.Windows.Controls;

namespace WimyGit.UserControls
{
    public partial class PendingTab : UserControl
    {
        public PendingTab()
        {
            InitializeComponent();

            PendingTabViewModel pendingTabViewModel = (PendingTabViewModel)DataContext;
            pendingTabViewModel.OnSelectAllCallbackViewSide = () => unstagedFileListBox.SelectAll();
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
