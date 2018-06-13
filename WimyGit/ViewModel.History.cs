using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;

namespace WimyGit
{
    partial class ViewModel
    {
        public ICommand DiffHistorySelectedFile { get; private set; }

        private void InitializeHistory()
        {
            HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();
            HistoryFileList = new System.Collections.ObjectModel.ObservableCollection<HistoryFile>();

            HistorySelectedCommand = new DelegateCommand(OnHistorySelectedCommand);
            MoreHistoryCommand = new DelegateCommand(OnMoreHistoryCommand);
            DiffHistorySelectedFile = new DelegateCommand((object parameter) => OnDiffHistroySelectedFile());

        }

        private void OnDiffHistroySelectedFile()
        {
            foreach (var filelist in HistoryFileList)
            {
                if (filelist.IsSelected)
                {
                    git_.DiffHistorySelected(HistoryDetailCommitId, filelist.FileName);
                }
            }
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
            public bool IsSelected
            {
                get { return is_selected_; }
                set
                {
                    if (is_selected_ == value)
                    {
                        return;
                    }
                    is_selected_ = value;

                    if (is_selected_)
                    {
                        view_model_.OnHistorySelectedCommand(this);
                    }
                }
            }
            private bool is_selected_ = false;
            public ViewModel view_model_;
        }

        public System.Collections.ObjectModel.ObservableCollection<HistoryStatus> HistoryList { get; set; }

        public class HistoryFile
        {
            public string Status { get; set; }
            public string FileName { get; set; }
            public string Directory { get; set; }
            public bool IsSelected { get; set; }
        }
        public System.Collections.ObjectModel.ObservableCollection<HistoryFile> HistoryFileList { get; set; }

        public ICommand MoreHistoryCommand { get; private set; }
        public void OnMoreHistoryCommand(object parameter)
        {
            if (HistoryList.Count == 0)
            {
                return;
            }
            AddHistoryFrom(SelectedPath, HistoryList.Count);
        }

        public ICommand HistorySelectedCommand { get; private set; }
        public void OnHistorySelectedCommand(object parameter)
        {
            HistoryStatus status = (HistoryStatus)parameter;
            HistoryDetail = status.Detail;

            HistoryDetailCommitId = status.CommitId;
            HistoryFileList.Clear();

            if (String.IsNullOrEmpty(status.CommitId) == false)
            {
                foreach (var file_info in git_.GetFilelistOfCommit(status.CommitId))
                {
                    HistoryFile file = new HistoryFile();
                    file.Directory = file_info.FileName;
                    file.Status = file_info.Status;
                    file.FileName = file_info.FileName;
                    file.IsSelected = false;
                    HistoryFileList.Add(file);
                }
            }
            NotifyPropertyChanged("HistoryFileList");
        }

        private string history_detail_;
        public string HistoryDetail
        {
            get
            {
                return history_detail_;
            }
            set
            {
                history_detail_ = value;
                NotifyPropertyChanged("HistoryDetail");
            }
        }

        public string HistoryDetailCommitId { get; set; }

        private string SelectedPath { get; set; }

        public void RefreshHistory(string selected_path)
        {
            HistoryList.Clear();

            SelectedPath = selected_path;
            AddHistoryFrom(selected_path, /*skip_count=*/0);
        }

        void AddHistoryFrom(string selected_path, Int32 skip_count)
        {
            var commits = git_.GetHistory(selected_path, skip_count, /*max_count=*/20);

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
                status.view_model_ = this;
                status.FontWeight = FontWeights.Normal;
                if (commit.RefNames != null && commit.RefNames.Contains(string.Format("HEAD -> {0}", git_.GetCurrentBranchName())))
                {
                    status.FontWeight = FontWeights.Bold;
                }
                HistoryList.Add(status);
            }

            PropertyChanged(this, new PropertyChangedEventArgs("HistoryList"));
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
