using System.Collections.ObjectModel;
using System.ComponentModel;

namespace WimyGit
{
    partial class ViewModel : System.ComponentModel.INotifyPropertyChanged
    {
        private RecentRepository recent_repository_;

        private ObservableCollection<string> repository_list_;
        public ObservableCollection<string> RepositoryList
        {
            get
            {
                return repository_list_;
            }
            set
            {
                repository_list_ = value;
            }
        }

        void InitializeRepositoryList()
        {
            recent_repository_ = new RecentRepository();

            RefreshRepositoryList();
        }

        private void RefreshRepositoryList()
        {
            repository_list_ = new ObservableCollection<string>();
            foreach(string directory_name in recent_repository_.GetList())
            {
                repository_list_.Add(directory_name);
            }

            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs("RepositoryList"));
            }
        }

        private void DirectoryUsed(string directory)
        {
            recent_repository_.Used(directory);
            RefreshRepositoryList();
        }
    }
}
