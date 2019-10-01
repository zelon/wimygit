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

			foreach (string directory_name in GlobalSetting.GetInstance().ConfigModel.RecentRepositoryPaths)
			{
				RepositoryList.Add(directory_name);
			}

			BrowseCommand = new DelegateCommand(OnBrowseCommand);
			OkayCommand = new DelegateCommand(OnOkayCommand);
		}

		public DelegateCommand BrowseCommand { get; private set; }
		void OnBrowseCommand(object sender)
		{
            GlobalSetting.GetInstance().ShowMsg("Drag folder from explorer");

            RunExternal runner = new RunExternal("explorer.exe", ".");
            runner.RunWithoutWaiting(Directory);
        }

		public DelegateCommand OkayCommand { get; private set; }
		void OnOkayCommand(object sender)
		{
            if (Util.IsValidGitDirectory(Directory) == false)
            {
                GlobalSetting.GetInstance().ShowMsg("Invalid git repository");
                return;
            }
			new_tab_result_(Directory);
		}
	}
}
