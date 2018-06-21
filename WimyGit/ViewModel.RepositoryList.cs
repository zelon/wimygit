using System.Collections.ObjectModel;
using System.ComponentModel;

namespace WimyGit
{
    partial class ViewModel : INotifyPropertyChanged
    {
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
            RefreshRepositoryList();
        }

        private void RefreshRepositoryList()
        {
            repository_list_ = new ObservableCollection<string>();
            foreach(string directory_name in Service.GetInstance().recent_repository_.GetList())
            {
                repository_list_.Add(directory_name);
            }

            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs("RepositoryList"));
            }
        }

        private void UpdateRecentUsedDirectoryList(string directory)
        {
            Service.GetInstance().recent_repository_.Used(directory);
            RefreshRepositoryList();
        }
    }
}
