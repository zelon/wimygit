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
        
        public class FileStatus
        {
            public string Status { get; set; }
            public string FilePath { get; set; }
            public bool IsSelected { get; set; }
        }

        public ViewModel()
        {
            TestCommand = new DelegateCommand(OnTestCommand);
            this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory);
            this.StageSelected = new DelegateCommand(this.OnStageSelected);
            this.ModifiedDiffCommand = new DelegateCommand(this.OnModifiedDiffCommand);
            StagedDiffCommand = new DelegateCommand(this.OnStagedDiffCommand);
            this.CommitCommand = new DelegateCommand(this.OnCommitCommand);
            this.Directory = @"E:\git\testGit";
            this.ModifiedList = new System.Collections.ObjectModel.ObservableCollection<FileStatus>();
            this.StagedList = new System.Collections.ObjectModel.ObservableCollection<FileStatus>();

        }

        public ICommand TestCommand { get; private set; }
        public void OnTestCommand (object parameter)
        {
            Console.WriteLine("test here");
        }

        public ICommand CommitCommand { get; private set; }
        public void OnCommitCommand(object parameter)
        {
            if (String.IsNullOrEmpty(CommitMessage))
            {
                AddLog("Empty commit message. Please fill commit message");
                return;
            }
            git_.Commit(CommitMessage);
            CommitMessage = "";
            Refresh();
        }

        public void OnModifiedDiffCommand(object parameter)
        {
            foreach(var filepath in SelectedModifiedFilePathList)
            {
              git_.Diff(filepath);
            }
        }

        public void OnStagedDiffCommand(object parameter)
        {
            foreach(var filepath in SelectedStagedFilePathList)
            {
              git_.DiffStaged(filepath);
            }
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

            var filelist = git_.GetModifiedFileList();
            var modified_backup = new SelectionRecover(ModifiedList);
            var staged_backup = new SelectionRecover(StagedList);
            this.ModifiedList.Clear();
            this.StagedList.Clear();
            foreach (var filestatus in filelist)
            {
                switch (filestatus.State)
                {
                    case LibGit2Sharp.FileStatus.Ignored:
                        continue;

                    case LibGit2Sharp.FileStatus.Added:
                        goto case LibGit2Sharp.FileStatus.Staged;
                    case LibGit2Sharp.FileStatus.Staged:
                        AddStagedList(filestatus, staged_backup);
                        break;

                    case LibGit2Sharp.FileStatus.Untracked:
                        goto case LibGit2Sharp.FileStatus.Modified;
                    case LibGit2Sharp.FileStatus.Modified:
                        AddModifiedList(filestatus, modified_backup);
                        break;

                    case LibGit2Sharp.FileStatus.Staged | LibGit2Sharp.FileStatus.Modified:
                        AddModifiedList(filestatus, modified_backup);
                        AddStagedList(filestatus, staged_backup);
                        break;

                    default:
                        System.Diagnostics.Debug.Assert(false);
                        AddLog("Cannot execute for filestatus:" + filestatus.State.ToString());
                        break;
                }
                AddLog(String.Format("[{0}] {1}", filestatus.State.ToString(), filestatus.FilePath));
            }

            if (ModifiedList.Count == 0 && StagedList.Count == 0)
            {
                AddLog("Nothing changed");
            }

            RefreshHistory();
            RefreshBranch();
        }

        void AddModifiedList(LibGit2Sharp.StatusEntry filestatus, SelectionRecover backup_selection)
        {
            FileStatus status = new FileStatus();
            status.Status = filestatus.State.ToString();
            status.FilePath = filestatus.FilePath;
            status.IsSelected = backup_selection.WasSelected(filestatus.FilePath);

            ModifiedList.Add(status);
            PropertyChanged(this, new PropertyChangedEventArgs("ModifiedList"));
        }

        void AddStagedList(LibGit2Sharp.StatusEntry filestatus, SelectionRecover backup_selection)
        {
            FileStatus status = new FileStatus();
            status.Status = filestatus.State.ToString();
            status.FilePath = filestatus.FilePath;
            status.IsSelected = backup_selection.WasSelected(filestatus.FilePath);

            StagedList.Add(status);
            PropertyChanged(this, new PropertyChangedEventArgs("StagedList"));
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

        private string commit_message_;
        public string CommitMessage
        {
            get
            {
                return commit_message_;
            }
            set
            {
                commit_message_ = value;
                NotifyPropertyChanged("CommitMessage");
            }
        }

        public ICommand ModifiedDiffCommand { get; private set; }
        public ICommand StagedDiffCommand { get; private set; }

        void OnStageSelected(object parameter)
        {
            if (SelectedModifiedFilePathList.Count() == 0)
            {
                AddLog("No selected to stage");
            }
            foreach (var filepath in SelectedModifiedFilePathList)
            {
                AddLog("Selected:" + filepath);
            }

            git_.Stage(SelectedModifiedFilePathList);

            Refresh();
        }
        public ICommand StageSelected { get; set; }

        public IEnumerable<string> SelectedModifiedFilePathList
        {
            get { return ModifiedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
        }

        public IEnumerable<string> SelectedStagedFilePathList
        {
            get { return StagedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
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

        public System.Collections.ObjectModel.ObservableCollection<FileStatus> ModifiedList { get; set; }
        public System.Collections.ObjectModel.ObservableCollection<FileStatus> StagedList { get; set; }
    }
}
