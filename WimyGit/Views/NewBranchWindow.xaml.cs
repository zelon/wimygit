using System.Windows;

namespace WimyGit.Views
{
    public partial class NewBranchWindow : Window
    {
        public MessageBoxResult Result { get; set; }

        public static MessageBoxResult NewWinddow(string commitId, out string branchName, out bool checkout)
        {
            NewBranchWindow newBranchWindow = new NewBranchWindow();
            newBranchWindow.Owner = GlobalSetting.GetInstance().GetWindow();
            newBranchWindow.CommitId.Content = commitId;
            newBranchWindow.ShowDialog();

            branchName = newBranchWindow.BranchName.Text;
            checkout = newBranchWindow.NeedCheckout.IsChecked.Value;

            if (string.IsNullOrEmpty(branchName))
            {
                return MessageBoxResult.Cancel;
            }
            return newBranchWindow.Result;
        }

        public NewBranchWindow()
        {
            InitializeComponent();
        }

        private void OnCreate(object sender, RoutedEventArgs e)
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
