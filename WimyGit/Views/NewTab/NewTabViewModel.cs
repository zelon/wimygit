using System;
using System.Collections.ObjectModel;
using System.Windows.Forms;

namespace WimyGit.UserControls
{
	public interface INewTabResult
	{
		void NewGitFilePath(string path);
	}

	class NewTabViewModel : NotifyBase
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
#pragma warning disable CA1416
            using FolderBrowserDialog folderBrowserDialog = new FolderBrowserDialog();
            var result = folderBrowserDialog.ShowDialog();
            if (result != DialogResult.OK)
            {
                return;
            }
            Directory = folderBrowserDialog.SelectedPath;
            NotifyPropertyChanged("Directory");
#pragma warning restore CA1416
        }

        public DelegateCommand OkayCommand { get; private set; }
		void OnOkayCommand(object sender)
		{
            if (Util.IsValidGitDirectory(Directory) == false)
            {
                if (UIService.AskAndGitInit(Directory) == false)
                {
                    return;
                }
            }
			new_tab_result_(Directory);
		}
	}
}
