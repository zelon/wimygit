using System.Collections.ObjectModel;

namespace WimyGit
{
    partial class ViewModel : System.ComponentModel.INotifyPropertyChanged
    {
        private ObservableCollection<string> repository_list_;
        public ObservableCollection<string> RepositoryList
        {
            get
            {
                if (repository_list_ == null)
                {
                    repository_list_ = new ObservableCollection<string>();
                    repository_list_.Add(@"E:\git\testGit");
                    repository_list_.Add(@"E:\git\WimyGit");
                }
                return repository_list_;
            }
            set
            {
                repository_list_ = value;
            }
        }
    }
}
