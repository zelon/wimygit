using System;
using System.Linq;
using System.Collections.Generic;
using System.ComponentModel;
using System.Windows.Input;

namespace WimyGit
{
    partial class ViewModel : System.ComponentModel.INotifyPropertyChanged, ILogger
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private RepositoryTab repository_tab_;
        private GitWrapper git_;

        public ViewModel(string git_repository_path, RepositoryTab repository_tab)
        {
            repository_tab_ = repository_tab;

            InitializeRepositoryList();
            InitializePending();
            InitializeHistory();

            ChangeDirectoryCommand = new DelegateCommand((object parameter) => ChangeDirectory());
            PushCommand = new DelegateCommand((object parameter) => Push());
            RefreshCommand = new DelegateCommand((object parameter) => Refresh());
            ViewTimelapseCommand = new DelegateCommand((object parameter) => ViewTimeLapse());
            FetchAllCommand = new DelegateCommand((object parameter) => FetchAll());
            PullCommand = new DelegateCommand(Pull);

            if (repository_list_.Count > 0)
            {
                Directory = repository_list_.ElementAt(0);
            }
            Directory = git_repository_path;
        }

        public void ViewTimeLapse()
        {
            if (string.IsNullOrEmpty(SelectedPath))
            {
                Service.GetInstance().ShowMsg("Select a file first");
                return;
            }
            git_.ViewTimeLapse(SelectedPath);
        }

        public void FetchAll()
        {
            DoWithProgressWindow("fetch --all");
        }

        public void DoWithProgressWindow(string cmd)
        {
            // http://stackoverflow.com/questions/2796470/wpf-create-a-dialog-prompt
            var cmds = new List<string>();
            cmds.Add(cmd);
            var console_progress_window = new ConsoleProgressWindow(Directory, cmds);
            console_progress_window.Owner = Service.GetInstance().GetWindow();
            console_progress_window.ShowDialog();
            Refresh();
        }

        public void Pull(object not_used)
        {
            DoWithProgressWindow("pull");
        }

        public void Push()
        {
            DoWithProgressWindow("push");
        }

        public void ChangeDirectory()
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
            git_ = new GitWrapper(Directory, this);

            repository_tab_.SetRootPath(Directory);

            Refresh();
            UpdateRecentUsedDirectoryList(Directory);
        }

        public void Refresh()
        {
            if (git_ == null)
            {
                return;
            }
            AddLog("Refreshing Directory:" + Directory);

            Service.GetInstance().RunCommandWithWaitingWindow("Refreshing...", () =>
            {
                // GetGitStatusPorcelainAll() call spend most time
                List<string> git_porcelain_result = git_.GetGitStatusPorcelainAll();
                // invoke for UI update after long time operation
                Service.GetInstance().GetWindow().Dispatcher.BeginInvoke(new Action(() =>
                {
                    RefreshPending(git_porcelain_result);
                    RefreshHistory(null);
                    RefreshBranch();
                    RefreshSignature();
                    repository_tab_.TreeView_Update(null, null);
                    AddLog(git_porcelain_result);
                    AddLog("Refreshed");
                }));
            });
        }

        private void RefreshSignature()
        {
            DisplayAuthor = git_.GetSignature();
            NotifyPropertyChanged("DisplayAuthor");
        }

        private void RefreshBranch()
        {
            if (git_ == null)
            {
                Branch = "Unknown";
            }
            else
            {
                string output = git_.GetCurrentBranchName();
                string ahead_or_behind = git_.GetCurrentBranchTrackingRemote();
                if (ahead_or_behind.Length > 0)
                {
                    output = string.Format("{0} - ({1})", git_.GetCurrentBranchName(), ahead_or_behind);
                }
                Branch = output;
            }
            NotifyPropertyChanged("Branch");
        }

        public void AddLog(string log)
        {
            Log += String.Format("[{0}] {1}\n", DateTime.Now.ToLocalTime(), log);
            NotifyPropertyChanged("Log");
        }

        public void AddLog(List<string> logs)
        {
            foreach (string log in logs)
            {
                Log += String.Format("[{0}] {1}\n", DateTime.Now.ToLocalTime(), log);
            }
            NotifyPropertyChanged("Log");
        }

        private void NotifyPropertyChanged(string name)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(name));
            }
        }
        public ICommand ChangeDirectoryCommand { get; private set; }
        public ICommand RefreshCommand { get; private set; }
        public ICommand ViewTimelapseCommand { get; private set; }
        public ICommand FetchAllCommand { get; private set; }
        public ICommand PullCommand { get; private set; }
        public ICommand PushCommand { get; private set; }

        private string _Directory;
        public string Directory {
            get { return _Directory; }
            set {
                if (value.Contains("External"))
                {
                    System.Diagnostics.Debug.Assert(false);
                    _Directory = value;
                }
                _Directory = value; }
        }
        public string Log { get; set; }
        public string Branch { get; set; }
        public string DisplayAuthor { get; set; }
    }
}
