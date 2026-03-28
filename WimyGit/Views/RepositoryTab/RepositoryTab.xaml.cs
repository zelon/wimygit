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

            UserControls.PendingTabViewModel pendingTabViewModel = (UserControls.PendingTabViewModel)PendingTab.DataContext;
            UserControls.StashTabViewModel stashTabViewModel = (UserControls.StashTabViewModel)StashTab.DataContext;
            UserControls.BranchTabViewModel branchTabViewModel = (UserControls.BranchTabViewModel)BranchTab.DataContext;
            UserControls.TagTabViewModel tagTabViewModel = (UserControls.TagTabViewModel)TagTab.DataContext;
            UserControls.RemoteTabViewModel remoteTabViewModel = (UserControls.RemoteTabViewModel)RemoteTab.DataContext;
            UserControls.WorktreeTabViewModel worktreeTabViewModel = (UserControls.WorktreeTabViewModel)WorktreeTab.DataContext;

            var viewModel = new ViewModels.RepositoryViewModel(git_repository_path,
                this,
                pendingTabViewModel,
                stashTabViewModel,
                branchTabViewModel,
                tagTabViewModel,
                remoteTabViewModel,
                worktreeTabViewModel,
                WorkspaceItem, QuickDiffItem, QuickDiffTab.TabControlMain);
            DataContext = viewModel;

            pendingTabViewModel.SetGitRepository(viewModel);
            stashTabViewModel.SetGitRepository(viewModel);
            branchTabViewModel.SetGitRepository(viewModel);
            tagTabViewModel.SetGitRepository(viewModel);
            remoteTabViewModel.SetGitRepository(viewModel);
            worktreeTabViewModel.SetGitRepository(viewModel);

            IGitRepository gitRepository = viewModel;
            Plugin.PluginController.ConstructPluginToolbarButtons(toolBar, gitRepository);
        }

        private void OnIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
		{
			bool previousVisibled = (bool)e.OldValue;
			bool newVisibled = (bool)e.NewValue;

			if (previousVisibled == false && newVisibled == true)
			{
				var task = GetViewModel().Refresh();
				task.GetAwaiter().OnCompleted(() => {
					GlobalSetting.GetInstance().ConfigModel.AddRecentRepository(git_repository_path_);
					GetViewModel().DirectoryTree.SetTreeViewRootPath(git_repository_path_);
					tabControl.Focus();
				});
			}
		}

		public void ScrollToEndLogTextBox()
		{
			logTextBox.ScrollToEnd();
		}

		private ViewModels.RepositoryViewModel GetViewModel()
		{
			return (ViewModels.RepositoryViewModel)this.DataContext;
		}

		public void EnterLoadingScreen()
		{
			Mouse.OverrideCursor = Cursors.Wait;

			LoadingScreen.Visibility = System.Windows.Visibility.Visible;
		}

		public void LeaveLoadingScreen()
		{
			LoadingScreen.Visibility = System.Windows.Visibility.Hidden;

			Mouse.OverrideCursor = null;
		}

        public void EnterFailedScreen()
        {
            LoadingScreen.Visibility = System.Windows.Visibility.Visible;

            var newColor = System.Windows.Media.Brushes.Red.Clone();
            newColor.Opacity = 0.5;
            LoadingScreen.Fill = newColor;
        }

        private void OnSplitterDoubleClick(object sender, MouseButtonEventArgs e)
        {
            double leftWidth = MainSplitGrid.ColumnDefinitions[0].ActualWidth;
            double rightWidth = MainSplitGrid.ColumnDefinitions[2].ActualWidth;
            if (leftWidth <= rightWidth)
            {
                MainSplitGrid.ColumnDefinitions[0].Width = new GridLength(2, GridUnitType.Star);
                MainSplitGrid.ColumnDefinitions[2].Width = new GridLength(1, GridUnitType.Star);
            }
            else
            {
                MainSplitGrid.ColumnDefinitions[0].Width = new GridLength(1, GridUnitType.Star);
                MainSplitGrid.ColumnDefinitions[2].Width = new GridLength(2, GridUnitType.Star);
            }
        }

        private void ShowPushMenu(object sender, RoutedEventArgs e)
        {
            Button button = PushButton;
            button.ContextMenu.PlacementTarget = button;
            button.ContextMenu.IsOpen = true;
        }

        private void ShowToolsMenu(object sender, RoutedEventArgs e)
        {
            Button button = ToolsButton;
            button.ContextMenu.PlacementTarget = button;
            button.ContextMenu.IsOpen = true;
        }
    }
}
