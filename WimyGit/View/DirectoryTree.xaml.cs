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

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            DirectoryTreeViewModel viewModel = (DirectoryTreeViewModel)DataContext;
            viewModel.treeView = treeView;
        }

        // Xaml 에서 마우스로 다른 path 를 클릭했을 때
        private void treeView_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            TreeViewItem selected_item = (TreeViewItem)e.NewValue;
            if (selected_item == null)
            {
                return;
            }

            ViewModel viewModel = ((DirectoryTreeViewModel)DataContext).ViewModel;
            viewModel.SelectedPath = selected_item.Tag as string;

            viewModel.HistoryTabMember.RefreshHistory(viewModel.SelectedPath);
        }
    }
}
