using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
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

            TestCommand = new DelegateCommand(OnTestCommand);
            this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory);

            if (repository_list_.Count > 0)
            {
                Directory = repository_list_.ElementAt(0);
            }
        }

        public ICommand TestCommand { get; private set; }
        public void OnTestCommand (object parameter)
        {
            Console.WriteLine("test here");
        }

        public void OnChangeDirectory(object parameter)
        {
            if (String.IsNullOrEmpty(Directory))
            {
                AddLog("Directory is empty");
                return;
            }
            if (System.IO.Directory.Exists(Directory) == false)
            {
                AddLog("Directory does not exist");
                return;
            }
            if (LibGit2Sharp.Repository.IsValid(Directory) == false)
            {
                AddLog("Directory is not a valid git directory");
                return;
            }
            git_ = new GitWrapper(Directory);

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
            RefreshHistory();
            RefreshBranch();
        }

        public ICommand ChangeDirectory { get; private set; }
        public string Directory { get; set; }

        private string branch_;
        public string Branch { get { return branch_; } set { branch_ = value; NotifyPropertyChanged("Branch"); } }

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
