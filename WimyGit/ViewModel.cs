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
            RefreshCommand = new DelegateCommand((object parameter) => Refresh());
            TimelapseCommand = new DelegateCommand((object parameter) => ViewTimeLapse());
            PullCommand = new DelegateCommand((object parameter) => OnPull());
        }

        public ICommand RefreshCommand { get; private set; }

        public ICommand TimelapseCommand { get; private set; }
        public void ViewTimeLapse()
        {
            git_.ViewTimeLapse(SelectedPath);
        }

        public ICommand PullCommand { get; private set; }
        public void OnPull()
        {
            git_.Pull();
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
            AddLog("Refreshing Directory:" + Directory);

            RefreshPending();
            RefreshHistory(null);
            RefreshBranch();
            RefreshSignature();
            RefreshDirectoryTree();
        }

        private void RefreshSignature()
        {
            var signature = git_.GetCurrentSignature();
            DisplayAuthor = String.Format("{0} <{1}>", signature.Name, signature.Email);
            NotifyPropertyChanged("DisplayAuthor");
        }

        private void RefreshDirectoryTree()
        {
            Service.GetInstance().RefreshDirectoryTree();
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
            log_ += String.Format("[{0}] {1}\n", DateTime.Now.ToLocalTime(), log);
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
