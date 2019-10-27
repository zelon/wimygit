using System.Windows;
using System.Windows.Controls;
using WimyGit.ViewModels;

namespace WimyGit.View
{
    public partial class DirectoryTree : UserControl
    {
        public DirectoryTree()
        {
            InitializeComponent();
        }

        private void OnTreeViewSelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            string selectedPath = treeView.SelectedValue as string;
            if (string.IsNullOrEmpty(selectedPath))
            {
                return;
            }
            DirectoryTreeViewModel viewModel = (DirectoryTreeViewModel)DataContext;
            viewModel.OnSelectedPathChanged(selectedPath);
        }
    }
}
