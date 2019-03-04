using System;
using System.Windows;
using System.Windows.Input;

namespace WimyGit.ViewModels
{
    public class HistoryTabViewModel : NotifyBase
    {
        public GitWrapper GitWrapper { get; private set; }
        private string HistorySelectedPath { get; set; }
        public HistoryTabViewModel(GitWrapper gitWrapper)
        {
            GitWrapper = gitWrapper;

            HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();
            HistoryFileList = new System.Collections.ObjectModel.ObservableCollection<HistoryFile>();

            HistorySelectedCommand = new DelegateCommand(OnHistorySelectedCommand);
            MoreHistoryCommand = new DelegateCommand(OnMoreHistoryCommand);
            DiffHistorySelectedFile = new DelegateCommand((object parameter) => OnDiffHistroySelectedFile());
        }

        public class HistoryStatus
        {
            public string Graph { get; set; }
            public string LocalDateTime { get; set; }
            public string CommitId { get; set; }
            public string Sha { get; set; }
            public string Author { get; set; }
            public string Comment { get; set; }
            public string Message { get; set; }
            public string ListMessage_RefNames { get; set; }
            public string ListMessage { get; set; }
            public string Detail { get; set; }
            public FontWeight FontWeight { get; set; }
            public bool IsSelected {
                get { return is_selected_; }
                set {
                    if (is_selected_ == value)
                    {
                        return;
                    }
                    is_selected_ = value;

                    if (is_selected_)
                    {
                        historyTabViewModel_.OnHistorySelectedCommand(this);
                    }
                }
            }
            private bool is_selected_ = false;
            public HistoryTabViewModel historyTabViewModel_;
        }

        public System.Collections.ObjectModel.ObservableCollection<HistoryStatus> HistoryList { get; set; }

        public class HistoryFile
        {
            public string Status { get; set; }
            public string Display { get; set; }
            public string FileName { get; set; }
            public string FileName2 { get; set; }
            public string Directory { get; set; }
            public bool IsSelected { get; set; }
        }
        public System.Collections.ObjectModel.ObservableCollection<HistoryFile> HistoryFileList { get; set; }

        public ICommand DiffHistorySelectedFile { get; private set; }

        private void OnDiffHistroySelectedFile()
        {
            foreach (var filelist in HistoryFileList)
            {
                if (filelist.IsSelected)
                {
                    if (string.IsNullOrEmpty(filelist.FileName2))
                    {
                        GitWrapper.DiffHistorySelected(HistoryDetailCommitId, filelist.FileName);
                    }
                    else
                    {
                        GitWrapper.DiffHistorySelectedWithRenameTracking(HistoryDetailCommitId, filelist.FileName, filelist.FileName2);
                    }
                }
            }
        }

        public ICommand MoreHistoryCommand { get; private set; }
        public void OnMoreHistoryCommand(object parameter)
        {
            if (HistoryList.Count == 0)
            {
                return;
            }
            AddHistoryFrom(HistorySelectedPath, HistoryList.Count);
        }

        public ICommand HistorySelectedCommand { get; private set; }
        public void OnHistorySelectedCommand(object parameter)
        {
            HistoryStatus status = (HistoryStatus)parameter;
            HistoryDetailCommitId = status.CommitId;
        }

        private string history_detail_;
        public string HistoryDetail {
            get {
                return history_detail_;
            }
            set {
                history_detail_ = value;
                NotifyPropertyChanged("HistoryDetail");
            }
        }

        public string HistoryDetailCommitId { get; set; }

        public void RefreshHistory(string selectedPath)
        {
            HistoryList.Clear();

            HistorySelectedPath = selectedPath;

            AddHistoryFrom(HistorySelectedPath, skip_count:0);
        }

        async void AddHistoryFrom(string selected_path, int skip_count)
        {
            var waiter = GitWrapper.GetHistory(selected_path, skip_count, /*max_count=*/20);
            var commits = await waiter;
            string currentBranchName = GitWrapper.GetCurrentBranchName();
            foreach (var commit in commits)
            {
                HistoryStatus status = new HistoryStatus();
                status.Graph = commit.Graph;
                status.LocalDateTime = commit.LocalTimeDate;
                if (commit.Sha != null)
                {
                    status.CommitId = commit.Sha.Substring(0, 7);
                }
                else
                {
                    status.CommitId = null;
                }
                status.Sha = commit.Sha;
                status.Author = commit.Author;
                status.Message = commit.Message;
                status.ListMessage_RefNames = commit.RefNames?.Trim();
                status.ListMessage = status.Message;
                status.Comment = commit.Message;
                status.Detail = MakeDetail(commit);
                status.IsSelected = false;
                status.historyTabViewModel_ = this;
                status.FontWeight = FontWeights.Normal;
                if (commit.RefNames != null && commit.RefNames.Contains(string.Format("HEAD -> {0}", currentBranchName)))
                {
                    status.FontWeight = FontWeights.Bold;
                }
                HistoryList.Add(status);
            }

            NotifyPropertyChanged("HistoryList");
        }

        private string MakeDetail(CommitInfo commit)
        {
            if (String.IsNullOrEmpty(commit.Sha))
            {
                return "No detail";
            }
            var builder = new System.Text.StringBuilder();
            builder.Append("Author: " + commit.Author);
            builder.Append("\n");
            builder.Append("Date: " + commit.LocalTimeDate);
            builder.Append("\n");
            builder.Append("Commit Id: " + commit.Sha);
            builder.Append("\n");
            builder.Append(commit.Message);
            builder.Append("\n");
            return builder.ToString();
        }

    }
}
