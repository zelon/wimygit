using System;
using System.Collections.ObjectModel;

namespace WimyGit.UserControls
{
	public interface INewTabResult
	{
		void NewGitFilePath(string path);
	}

	class NewTabViewModel
	{
		public string Directory { get; set; }
		public ObservableCollection<string> RepositoryList { get; set; }

		private Action<string> new_tab_result_;

		public NewTabViewModel(Action<string> new_tab_result)
		{
			new_tab_result_ = new_tab_result;

			RepositoryList = new ObservableCollection<string>();

			foreach (string directory_name in Service.GetInstance().ConfigModel.RecentRepositoryPaths)
			{
				RepositoryList.Add(directory_name);
			}

			BrowseCommand = new DelegateCommand(OnBrowseCommand);
			OkayCommand = new DelegateCommand(OnOkayCommand);
		}

		public DelegateCommand BrowseCommand { get; private set; }
		void OnBrowseCommand(object sender)
		{
			using (var dialog = new System.Windows.Forms.FolderBrowserDialog())
			{
				var result = dialog.ShowDialog();
				if (result == System.Windows.Forms.DialogResult.OK)
				{
					new_tab_result_(dialog.SelectedPath);
					return;
				}
			}
		}

		public DelegateCommand OkayCommand { get; private set; }
		void OnOkayCommand(object sender)
		{
			new_tab_result_(Directory);
		}
	}
}
