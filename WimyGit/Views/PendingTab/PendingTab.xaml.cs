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
    }
}
