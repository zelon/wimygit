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
            InitializePending();

            TestCommand = new DelegateCommand(OnTestCommand);
            this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory);
            this.Directory = @"E:\git\testGit";
        }

        public ICommand TestCommand { get; private set; }
        public void OnTestCommand (object parameter)
        {
            Console.WriteLine("test here");
        }

        public void OnChangeDirectory(object parameter)
        {
            git_ = new GitWrapper(Directory);

            Refresh();
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
