using System;
using System.Linq;
using System.ComponentModel;
using System.Windows.Input;

namespace WimyGit
{
    partial class ViewModel : System.ComponentModel.INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private GitWrapper git_;

        public ViewModel()
        {
            InitializeRepositoryList();
            InitializePending();
            InitializeHistory();

            TestCommand = new DelegateCommand(OnTestCommand);
            this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory);

            GitPushCommand = new DelegateCommand((object paramter) => git_.GitPush());

            if (repository_list_.Count > 0)
            {
                Directory = repository_list_.ElementAt(0);
            }
        }

        public ICommand TestCommand { get; private set; }
        public void OnTestCommand(object parameter)
        {
            Console.WriteLine("test here");
        }

        public ICommand GitPushCommand { get; private set; }

      public void OnChangeDirectory(object parameter)
        {
            if (String.IsNullOrEmpty(Directory))
            {
                string msg = "Directory is empty";
                Service.GetInstance().ShowMsg(msg);
                return;
            }
            if (System.IO.Directory.Exists(Directory) == false)
            {
                string msg = "Directory does not exist";
                Service.GetInstance().ShowMsg(msg);
                return;
            }
            if (LibGit2Sharp.Repository.IsValid(Directory) == false)
            {
                string msg = "Directory is not a valid git directory";
                Service.GetInstance().ShowMsg(msg);
                return;
            }
            git_ = new GitWrapper(Directory);

            Service.GetInstance().SetRootPath(Directory);
            Refresh();

            DirectoryUsed(Directory);
        }

        public void Refresh()
        {
            if (git_ == null)
            {
                return;
            }
            AddLog("Check repository:" + Directory);

            RefreshPending();
            RefreshHistory(null);
            RefreshBranch();
            RefreshSignature();
        }

        private void RefreshSignature()
        {
            var signature = git_.GetCurrentSignature();
            DisplayAuthor = String.Format("{0} <{1}>", signature.Name, signature.Email);
            NotifyPropertyChanged("DisplayAuthor");
        }

        public ICommand ChangeDirectory { get; private set; }
        public string Directory { get; set; }

        private string branch_;
        public string Branch { get { return branch_; } set { branch_ = value; NotifyPropertyChanged("Branch"); } }
        public string DisplayAuthor { get; set; }

        void RefreshBranch()
        {
            if (git_ == null)
            {
                Branch = "Unknown";
            }
            else
            {
                string output = git_.GetCurrentBranch();
                string ahead_or_behind = git_.GetCurrentBranchTrackingRemote();
                if (ahead_or_behind.Length > 0)
                {
                    output = string.Format("{0} - ({1})", git_.GetCurrentBranch(), ahead_or_behind);
                }
                Branch = output;
            }
        }

        private string log_;
        public string Log
        {
            get { return log_; }
            set { log_ = value; }
        }
        public void AddLog(string log)
        {
            log_ += log + "\n";
            NotifyPropertyChanged("Log");
        }

        private void NotifyPropertyChanged(string name)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(name));
            }
        }
    }
}
