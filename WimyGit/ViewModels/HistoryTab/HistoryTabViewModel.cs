using System;
using System.Windows;
using System.Windows.Input;
using WimyGit.Service;

namespace WimyGit.ViewModels
{
    public class HistoryTabViewModel : NotifyBase
    {
        public GitWrapper GitWrapper { get; private set; }
        private string HistorySelectedPath { get; set; }
        public string SelectedRepositoryPath { get; set; }
        public string CurrentBranchName { get; set; }
        public HistoryStatus SelectedHistoryStatus { get; set; }
        public HistoryFile SelectedHistoryFile { get; set; }

        public ICommand CreateBranchCommand { get; private set; }
        public ICommand CreateTagCommand { get; private set; }

        public HistoryTabViewModel(GitWrapper gitWrapper)
        {
            GitWrapper = gitWrapper;

            HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();

            CreateBranchCommand = new DelegateCommand(OnCreateBranchCommand);
            CreateTagCommand = new DelegateCommand(OnCreateTagCommand);
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
            public HistoryTabViewModel historyTabViewModel_;
        }

        public System.Collections.ObjectModel.ObservableCollection<HistoryStatus> HistoryList { get; set; }

        public void OnCreateBranchCommand(object parameter)
        {
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string branchName = UIService.GetInstance().AskAndGetString("Enter branch name", "");
            if (branchName == null)
            {
                return;
            }
            GitWrapper.CreateBranch(SelectedHistoryStatus.CommitId, branchName);
        }

        public void OnCreateTagCommand(object parameter)
        {
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string tagName = UIService.GetInstance().AskAndGetString("Enter tag name", "");
            if (tagName == null)
            {
                return;
            }
            GitWrapper.CreateTag(SelectedHistoryStatus.CommitId, tagName);
        }

        public ICommand DiffHistorySelectedFile { get; private set; }

        private void OnDiffHistroySelectedFile()
        {
            if (SelectedHistoryFile == null)
            {
                MessageBox.ShowMessage("Select file first in files tab");
                return;
            }
            if (string.IsNullOrEmpty(SelectedHistoryFile.FileName2))
            {
                GitWrapper.DiffHistorySelected(SelectedHistoryFile.CommitId, SelectedHistoryFile.FileName);
            }
            else
            {
                GitWrapper.DiffHistorySelectedWithRenameTracking(SelectedHistoryFile.CommitId, SelectedHistoryFile.FileName, SelectedHistoryFile.FileName2);
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
