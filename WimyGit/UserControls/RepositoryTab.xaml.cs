using System.Windows;
using System.Windows.Input;
using System.Windows.Controls;

namespace WimyGit
{
	public partial class RepositoryTab : UserControl
	{
		private string git_repository_path_;

		public RepositoryTab(string git_repository_path)
		{
			git_repository_path_ = git_repository_path;

			InitializeComponent();

			DataContext = new ViewModel(git_repository_path, this);
		}

		private void OnIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
		{
			bool previousVisibled = (bool)e.OldValue;
			bool newVisibled = (bool)e.NewValue;

			if (previousVisibled == false && newVisibled == true)
			{
				var task = GetViewModel().Refresh();
				task.GetAwaiter().OnCompleted(() => {
					Service.GetInstance().ConfigModel.AddRecentRepository(git_repository_path_);
					GetViewModel().DirectoryTree.SetTreeViewRootPath(git_repository_path_);
					tabControl.Focus();
				});
			}
		}

		public void ScrollToEndLogTextBox()
		{
			logTextBox.ScrollToEnd();
		}

		private ViewModel GetViewModel()
		{
			return (ViewModel)this.DataContext;
		}

		public void SelectAllUnstagedFilesListBox()
		{
			unstagedFileListBox.SelectAll();
		}

		public void EnterLoadingScreen()
		{
			Mouse.OverrideCursor = Cursors.Wait;

			LoadingScreen.Visibility = System.Windows.Visibility.Visible;
			LoadingScreen.Width = 6000;
			LoadingScreen.Height = 6000;
		}

		public void LeaveLoadingScreen()
		{
			LoadingScreen.Visibility = System.Windows.Visibility.Hidden;
			LoadingScreen.Width = 1;
			LoadingScreen.Height = 1;

			Mouse.OverrideCursor = null;
		}

        public void EnterFailedScreen()
        {
            LoadingScreen.Visibility = System.Windows.Visibility.Visible;
            LoadingScreen.Width = 6000;
            LoadingScreen.Height = 6000;

            var newColor = System.Windows.Media.Brushes.Red.Clone();
            newColor.Opacity = 0.5;
            LoadingScreen.Fill = newColor;
        }
    }
}
