using System.Windows;
using System.Windows.Forms;

namespace WimyGit.Views
{
    public partial class NewWorktreeWindow : Window
    {
        public MessageBoxResult Result { get; set; }

        public static MessageBoxResult NewWindow(string currentBranch, out string path, out string branch, out bool isNewBranch)
        {
            NewWorktreeWindow window = new NewWorktreeWindow();
            window.Owner = GlobalSetting.GetInstance().GetWindow();
            window.BranchName.Text = currentBranch;
            window.ShowDialog();

            path = window.WorktreePath.Text;
            branch = window.BranchName.Text;
            isNewBranch = window.CreateNewBranch.IsChecked == true;

            if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(branch))
            {
                return MessageBoxResult.Cancel;
            }
            return window.Result;
        }

        public NewWorktreeWindow()
        {
            InitializeComponent();
            BranchName.IsReadOnly = true;
        }

        private void OnCreateNewBranchChanged(object sender, RoutedEventArgs e)
        {
            BranchName.IsReadOnly = CreateNewBranch.IsChecked != true;
        }

        private void OnBrowse(object sender, RoutedEventArgs e)
        {
#pragma warning disable CA1416
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Select worktree directory";
                if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                {
                    WorktreePath.Text = dialog.SelectedPath;
                }
            }
#pragma warning restore CA1416
        }

        private void OnAdd(object sender, RoutedEventArgs e)
        {
            Result = MessageBoxResult.OK;
            Close();
        }

        private void OnCancel(object sender, RoutedEventArgs e)
        {
            Result = MessageBoxResult.Cancel;
            Close();
        }
    }
}
