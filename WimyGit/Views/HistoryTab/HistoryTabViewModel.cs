using System;
using System.Windows;
using System.Windows.Input;
using WimyGit.Views;

namespace WimyGit.ViewModels
{
    public class HistoryTabViewModel : NotifyBase
    {
        public readonly WeakReference<IGitRepository> _gitRepository;
        private string HistorySelectedPath { get; set; }
        public string SelectedRepositoryPath { get; set; }
        public string CurrentBranchName { get; set; }
        public HistoryStatus SelectedHistoryStatus { get; set; }
        public HistoryFile SelectedHistoryFile { get; set; }

        public ICommand CreateBranchCommand { get; private set; }
        public ICommand CreateTagCommand { get; private set; }
        public ICommand RebaseCommand { get; private set; }
        public ICommand CheckoutCommand { get; private set; }
        public ICommand ResetSoftCommand { get; private set; }
        public ICommand ResetMixedCommand { get; private set; }
        public ICommand ResetHardCommand { get; private set; }
        public ICommand CopyCommitIdCommand { get; private set; }

        public IGitRepository TryGetGitRepository()
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return null;
            }
            return gitRepository;
        }

        public HistoryTabViewModel(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);

            HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();

            CreateBranchCommand = new DelegateCommand(OnCreateBranchCommand);
            CreateTagCommand = new DelegateCommand(OnCreateTagCommand);
            RebaseCommand = new DelegateCommand(OnRebaseCommand);
            CheckoutCommand = new DelegateCommand(OnCheckoutCommand);

            ResetSoftCommand = new DelegateCommand(OnResetSoftCommand);
            ResetMixedCommand = new DelegateCommand(OnResetMixedCommand);
            ResetHardCommand = new DelegateCommand(OnResetHardCommand);

            CopyCommitIdCommand = new DelegateCommand(OnCopyCommitIdCommand);
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
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            var result = NewBranchWindow.NewWinddow(SelectedHistoryStatus.CommitId, out string newBranchName, out bool checkout);
            if (result == MessageBoxResult.Cancel)
            {
                return;
            }

            if (checkout)
            {
                gitRepository.GetGitWrapper().CreateBranchWithCheckout(SelectedHistoryStatus.CommitId, newBranchName);
            }
            else
            {
                gitRepository.GetGitWrapper().CreateBranch(SelectedHistoryStatus.CommitId, newBranchName);
            }

            gitRepository.Refresh();
        }

        public void OnCreateTagCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string tagName = UIService.AskAndGetString("Enter tag name", "");
            if (tagName == null)
            {
                return;
            }
            gitRepository.GetGitWrapper().CreateTag(SelectedHistoryStatus.CommitId, tagName);

            gitRepository.Refresh();
        }

        public void OnRebaseCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string gitCommand = $"rebase {SelectedHistoryStatus.CommitId}";
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(gitCommand);
            gitRepository.Refresh();
        }

        public void OnCheckoutCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string gitCommand = GitCommandCreator.Checkout(SelectedHistoryStatus.CommitId);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(gitCommand);
            gitRepository.Refresh();
        }

        public void OnResetSoftCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string gitCommand = GitCommandCreator.ResetSoft(SelectedHistoryStatus.CommitId);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(gitCommand);
            gitRepository.Refresh();
        }

        public void OnResetMixedCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            string gitCommand = GitCommandCreator.ResetMixed(SelectedHistoryStatus.CommitId);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(gitCommand);
            gitRepository.Refresh();
        }

        public void OnResetHardCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            var result = UIService.ShowMessageWithOKCancel("Reset hard can affect on working directory. Continue?");
            if (result != MessageBoxResult.OK)
            {
                return;
            }
            string gitCommand = GitCommandCreator.ResetHard(SelectedHistoryStatus.CommitId);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(gitCommand);
            gitRepository.Refresh();
        }

        public void OnCopyCommitIdCommand(object parameter)
        {
            if (SelectedHistoryStatus == null)
            {
                return;
            }
            try
            {
                Clipboard.SetText(SelectedHistoryStatus.CommitId);
            }
            catch (Exception exception)
            {
                UIService.ConfirmMsg("Cannot copy to clipboard: " + exception.Message, "Error");
            }
        }

        public ICommand DiffHistorySelectedFile { get; private set; }

        private void OnDiffHistroySelectedFile()
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedHistoryFile == null)
            {
                UIService.ShowMessage("Select file first in files tab");
                return;
            }
            if (string.IsNullOrEmpty(SelectedHistoryFile.FileName2))
            {
                gitRepository.GetGitWrapper().DiffHistorySelected(SelectedHistoryFile.CommitId, SelectedHistoryFile.FileName);
            }
            else
            {
                gitRepository.GetGitWrapper().DiffHistorySelectedWithRenameTracking(SelectedHistoryFile.CommitId, SelectedHistoryFile.FileName, SelectedHistoryFile.FileName2);
            }
        }

        public ICommand MoreHistoryCommand { get; private set; }
        public void OnMoreHistoryCommand(object parameter)
        {
            if (HistoryList.Count == 0)
            {
                return;
            }
            int historyCount = 0;
            foreach (var history in HistoryList)
            {
                if (string.IsNullOrEmpty(history.CommitId)) // if history has only graph data, commit id is invalid
                {
                    continue;
                }
                ++historyCount;
            }
            AddHistoryFrom(HistorySelectedPath, historyCount);
        }

        public void RefreshHistory(string selectedPath)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            HistoryList.Clear();

            HistorySelectedPath = selectedPath;
            SelectedRepositoryPath = selectedPath.Replace(gitRepository.GetRepositoryDirectory(), "").Replace(@"\", "/");
            if (string.IsNullOrEmpty(SelectedRepositoryPath))
            {
                SelectedRepositoryPath = "/";
            }
            NotifyPropertyChanged("SelectedRepositoryPath");

            AddHistoryFrom(HistorySelectedPath, skip_count:0);
        }

        private async void AddHistoryFrom(string selected_path, int skip_count)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            var waiter = gitRepository.GetGitWrapper().GetHistory(selected_path, skip_count, /*max_count=*/100);
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
