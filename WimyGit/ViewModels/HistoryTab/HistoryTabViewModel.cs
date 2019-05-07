using System;
using System.Windows;
using System.Windows.Input;

namespace WimyGit.ViewModels
{
    public class HistoryTabViewModel : NotifyBase
    {
        public GitWrapper GitWrapper { get; private set; }
        private string HistorySelectedPath { get; set; }
        public string SelectedRepositoryPath { get; set; }
        public string CurrentBranchName { get; set; }
        public string SelectedDisplayOnHistoryFiles { get; set; }

        public HistoryTabViewModel(GitWrapper gitWrapper)
        {
            GitWrapper = gitWrapper;

            HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();

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

        public ICommand DiffHistorySelectedFile { get; private set; }

        private void OnDiffHistroySelectedFile()
        {
            string filenameDisplay = SelectedDisplayOnHistoryFiles;
            if (string.IsNullOrEmpty(filenameDisplay))
            {
                return;
            }
            string[] filenames = filenameDisplay.Split(new string[] { CommitIdToFileListConverter.kFilenameSeperator }, StringSplitOptions.None);
            if (filenames.Length == 1)
            {
                string filename = filenames[0];
                GitWrapper.DiffHistorySelected(HistoryDetailCommitId, filename);
            }
            else
            {
                System.Diagnostics.Debug.Assert(filenames.Length == 2);
                string filename1 = filenames[0];
                string filename2 = filenames[1];
                GitWrapper.DiffHistorySelectedWithRenameTracking(HistoryDetailCommitId, filename1, filename2);
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

        public string HistoryDetailCommitId { get; set; }

        public void RefreshHistory(string selectedPath)
        {
            HistoryList.Clear();

            HistorySelectedPath = selectedPath;
            SelectedRepositoryPath = selectedPath.Replace(GitWrapper.GetPath(), "").Replace(@"\", "/");
            if (string.IsNullOrEmpty(SelectedRepositoryPath))
            {
                SelectedRepositoryPath = "/";
            }
            NotifyPropertyChanged("SelectedRepositoryPath");

            AddHistoryFrom(HistorySelectedPath, skip_count:0);
        }

        async void AddHistoryFrom(string selected_path, int skip_count)
        {
            var waiter = GitWrapper.GetHistory(selected_path, skip_count, /*max_count=*/20);
            var commits = await waiter;
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
                if (commit.RefNames != null && commit.RefNames.Contains(string.Format("HEAD -> {0}", CurrentBranchName)))
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
