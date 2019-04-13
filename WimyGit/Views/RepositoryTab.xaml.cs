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

			DataContext = new ViewModels.RepositoryViewModel(git_repository_path, this);
		}

        private void ConstructPluginToolbarButtons()
        {
            foreach (var pluginData in Service.PluginController.GetPlugins())
            {
                AddToolbarButton(pluginData);
            }
        }

        private void AddToolbarButton(Service.PluginData pluginData)
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
                    GlobalSetting.GetInstance().ShowMsg("Git is null");
                    return;
                }
                string workingDirectory = git.GetPath();

                switch (pluginData.ExecutionType)
                {
                    case Service.ExecutionType.kWithoutShellAndNoWaiting:
                        RunExternal runner = new RunExternal(pluginData.Command, workingDirectory);
                        try
                        {
                            runner.RunWithoutWaiting(pluginData.Argument);
                        }
                        catch (System.Exception exception)
                        {
                            GlobalSetting.GetInstance().ShowMsg("Cannot execute. " + exception.Message);
                        }
                        return;
                    case Service.ExecutionType.kWimyGitInnerShellAndRefreshRepositoryStatus:
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
