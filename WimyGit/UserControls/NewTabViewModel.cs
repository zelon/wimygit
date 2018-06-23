using System.Collections.ObjectModel;
using System.ComponentModel;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit.UserControls
{
    public interface INewTabResult
    {
        void NewGitFilePath(string path);
    }

    class NewTabViewModel
    {
        public string Directory { get;set; }
        public ObservableCollection<string> RepositoryList { get; set; }

        private Action<string> new_tab_result_;

        public NewTabViewModel(Action<string> new_tab_result)
        {
            new_tab_result_ = new_tab_result;

            RepositoryList = new ObservableCollection<string>();

            foreach (string directory_name in Service.GetInstance().recent_repository_.GetList())
            {
                RepositoryList.Add(directory_name);
            }

            BrowseCommand = new DelegateCommand(OnBrowseCommand);
            OkayCommand = new DelegateCommand(OnOkayCommand);
        }

        public DelegateCommand BrowseCommand { get; private set; }
        void OnBrowseCommand(object sender)
        {

        }

        public DelegateCommand OkayCommand { get; private set; }
        void OnOkayCommand (object sender)
        {
            new_tab_result_(Directory);
        }
    }
}
