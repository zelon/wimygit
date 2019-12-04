using System;
using System.Windows;
using System.Windows.Media.Imaging;
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

            ConstructPluginToolbarButtons();

            UserControls.BranchAndTagTabViewModel branchAndTagTabViewModel = (UserControls.BranchAndTagTabViewModel)BranchAndTagTab.DataContext;

            var viewModel = new ViewModels.RepositoryViewModel(git_repository_path, this, branchAndTagTabViewModel);
            DataContext = viewModel;
            branchAndTagTabViewModel.SetGitRepository(viewModel);
		}

        private void ConstructPluginToolbarButtons()
        {
            // Default Plugins
            {
                AddToolbarButton(CreateGitRemoteShowPlugin());
            }
            foreach (Plugin.PluginData pluginData in Plugin.PluginController.GetPlugins())
            {
                AddToolbarButton(pluginData);
            }
        }

        private Plugin.PluginData CreateGitRemoteShowPlugin()
        {
            return new Plugin.PluginData(
                title: "RemoteInfo",
                iconPath: @"..\..\Images\Extension.png",
                command: "git",
                argument: "remote -v show",
                executionType: Plugin.ExecutionType.WimyGitInnerShellAndRefreshRepositoryStatus);
        }

        private void AddToolbarButton(Plugin.PluginData pluginData)
        {
            Button button = new Button();
            button.Width = 100;
            StackPanel stackPanel = new StackPanel();
            stackPanel.Orientation = Orientation.Vertical;

            BitmapImage bitmapImage = new BitmapImage(new System.Uri(pluginData.IconPath, UriKind.RelativeOrAbsolute));
            Image image = new Image();
            image.Source = bitmapImage;
            image.Width = 32;
            image.Height = 32;

            TextBlock textBlock = new TextBlock();
            textBlock.HorizontalAlignment = HorizontalAlignment.Center;
            textBlock.Text = pluginData.Title;

            stackPanel.Children.Add(image);
            stackPanel.Children.Add(textBlock);

            button.Content = stackPanel;

            button.Command = new DelegateCommand((object parameter) =>
            {
                var git = GetViewModel().git_;
                if (git == null)
                {
                    MessageBox.ShowMessage("Git is null");
                    return;
                }
                string workingDirectory = git.GetPath();

                switch (pluginData.ExecutionType)
                {
                    case Plugin.ExecutionType.WithoutShellAndNoWaiting:
                        RunExternal runner = new RunExternal(pluginData.Command, workingDirectory);
                        try
                        {
                            runner.RunWithoutWaiting(pluginData.Argument);
                        }
                        catch (System.Exception exception)
                        {
                            MessageBox.ShowMessage("Cannot execute. " + exception.Message);
                        }
                        return;
                    case Plugin.ExecutionType.WimyGitInnerShellAndRefreshRepositoryStatus:
                        GetViewModel().DoWithProgressWindow(pluginData.Command, pluginData.Argument);
                        return;
                }
            });

            toolBar.Items.Add(button);
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

		public void SelectAllUnstagedFilesListBox()
		{
			unstagedFileListBox.SelectAll();
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
    }
}
