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
            ((DirectoryTreeViewModel)DataContext).OnSelectedPathChanged(treeView.SelectedValue as string);
        }
    }
}
