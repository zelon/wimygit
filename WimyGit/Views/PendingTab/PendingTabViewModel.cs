using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Windows.Input;
using WimyGitLib;

namespace WimyGit.UserControls
{
    public class PendingTabViewModel : NotifyBase
    {
        public ObservableCollection<FileStatus> ModifiedList { get; set; }
        public ObservableCollection<FileStatus> StagedList { get; set; }

        public ICommand SelectAllCommand { get; private set; }
        public DelegateCommand StageSelectedCommand { get; private set; }
        public DelegateCommand StageSelectedPartialCommand { get; private set; }
        public ICommand AmendClickedCommand { get; private set; }
        public ICommand CommitCommand { get; private set; }
        public ICommand ModifiedDiffCommand { get; private set; }
        public ICommand StagedDiffCommand { get; private set; }
        public ICommand UnstageCommand { get; private set; }
        public ICommand RevertCommand { get; private set; }
        public ICommand OpenExplorerSelectedFileCommand { get; private set; }
        public ICommand OpenSelectedFileCommand { get; private set; }
        public ICommand MergeToolCommand { get; private set; }

        public Action OnSelectAllCallbackViewSide;

        private WeakReference<IGitRepository> _gitRepository;
        private bool noCommitsYet_ = false;
        private string commit_message_;
        public string CommitMessage {
            get { return commit_message_; }
            set {
                commit_message_ = value;
                NotifyPropertyChanged("CommitMessage");
            }
        }

        public bool IsAmendCommit { get; set; }

        public PendingTabViewModel()
        {
            StageSelectedCommand = new DelegateCommand(OnStageSelectedCommand, CanStageSelected);
            StageSelectedPartialCommand = new DelegateCommand(OnStageSelectedPartialCommand, CanStageSelectedPartial);
            ModifiedDiffCommand = new DelegateCommand(OnModifiedDiffCommand);
            StagedDiffCommand = new DelegateCommand(OnStagedDiffCommand);
            UnstageCommand = new DelegateCommand(OnUnstageCommand);
            AmendClickedCommand = new DelegateCommand(OnAmendClickedCommand);
            CommitCommand = new DelegateCommand(OnCommitCommand);
            RevertCommand = new DelegateCommand(OnRevertCommand);
            OpenExplorerSelectedFileCommand = new DelegateCommand(OnOpenExplorerSelectedFileCommand);
            OpenSelectedFileCommand = new DelegateCommand(OnOpenSelectedFileCommand);
            MergeToolCommand = new DelegateCommand(OnMergeToolCommand);

            SelectAllCommand = new DelegateCommand(OnSelectAllCommand);

            ModifiedList = new ObservableCollection<FileStatus>();
            StagedList = new ObservableCollection<FileStatus>();
        }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public void RefreshPending(List<string> porcelains)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            var modified_backup = new SelectionRecover(ModifiedList);
            var staged_backup = new SelectionRecover(StagedList);
            var collecting_staged = new ObservableCollection<FileStatus>();
            var collecting_modified = new ObservableCollection<FileStatus>();

            foreach (var porcelain in porcelains)
            {
                GitFileStatus status = GitPorcelainParser.ParseFileStatus(porcelain);
                if (status.Staged != null)
                {
                    AddStagedList(status.Staged, staged_backup, collecting_staged);
                }
                if (status.Unmerged != null)
                {
                    AddModifiedList(status.Unmerged, modified_backup, collecting_modified);
                }
                if (status.Modified != null)
                {
                    AddModifiedList(status.Modified, modified_backup, collecting_modified);
                }
            }
            StagedList = collecting_staged;
            ModifiedList = collecting_modified;

            NotifyPropertyChanged("StagedList");
            NotifyPropertyChanged("ModifiedList");

            if (ModifiedList.Count == 0 && StagedList.Count == 0)
            {
                gitRepository.AddLog("Nothing changed");
            }
        }


        void AddModifiedList(WimyGitLib.GitFileStatus.Pair git_file_status, SelectionRecover backup_selection,
                             ObservableCollection<FileStatus> to)
        {
            FileStatus status = new FileStatus(this);
            status.Status = git_file_status.Description;
            status.FilePath = git_file_status.Filename;
            status.Display = status.FilePath;
            status.IsSelected = backup_selection.WasSelected(status.FilePath);

            to.Add(status);
        }

        void AddStagedList(WimyGitLib.GitFileStatus.Pair git_file_status, SelectionRecover backup_selection,
                           ObservableCollection<FileStatus> to)
        {
            FileStatus status = new FileStatus(this);
            status.Status = git_file_status.Description;
            status.FilePath = git_file_status.Filename;
            status.Display = status.FilePath;
            status.IsSelected = backup_selection.WasSelected(status.FilePath);

            to.Add(status);
        }



        async void OnStageSelectedCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedModifiedFilePathList.Count() == 0)
            {
                gitRepository.AddLog("No selected to stage");
                return;
            }
            List<string> logs = new List<string>();
            foreach (var filepath in SelectedModifiedFilePathList)
            {
                logs.Add("Stage: " + filepath);
            }

            gitRepository.GetGitWrapper().Stage(SelectedModifiedFilePathList);

            gitRepository.AddLog(logs);
            await gitRepository.Refresh();
        }

        bool CanStageSelected(object parameter)
        {
            if (SelectedModifiedFilePathList.Count() > 0)
            {
                return true;
            }
            return false;
        }


        public void OnSelectAllCommand(object parameter)
        {
            foreach (var f in ModifiedList)
            {
                f.IsSelected = true;
            }
            NotifyPropertyChanged("ModifiedList");
            OnSelectAllCallbackViewSide();
        }

        public async void OnAmendClickedCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (IsAmendCommit == false)
            {
                return;
            }
            string cmd = GitCommandCreator.GetLastCommitMessage();
            List<string> lines = await gitRepository.CreateGitRunner().RunAsync(cmd);
            if (lines.Count < 2)
            {
                UIService.ShowMessage("Invalid HEAD commit message");
                return;
            }
            // remove empty last line
            if (string.IsNullOrEmpty(lines[lines.Count - 1]))
            {
                lines.RemoveAt(lines.Count - 1);
            }
            string lastCommitMessage = string.Join(Environment.NewLine, lines);
            string showMessage = $"{lastCommitMessage}{Environment.NewLine}{Environment.NewLine}Use above HEAD message as amend commit message?";
            if (UIService.ShowMessageWithYesNo(showMessage) == System.Windows.MessageBoxResult.Yes)
            {
                CommitMessage = lastCommitMessage;
                NotifyPropertyChanged("CommitMessage");
            }
        }

        public async void OnCommitCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (String.IsNullOrEmpty(CommitMessage))
            {
                UIService.ShowMessage("Empty commit message");
                return;
            }
            if (StagedList.Count == 0)
            {
                UIService.ShowMessage("No staged file");
                return;
            }
            gitRepository.GetGitWrapper().Commit(CommitMessage, IsAmendCommit);
            CommitMessage = "";
            IsAmendCommit = false;
            NotifyPropertyChanged("IsAmendCommit");
            await gitRepository.Refresh();
        }

        void OnStageSelectedPartialCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedModifiedFilePathList.Count() != 1)
            {
                gitRepository.AddLog("Select only one file at once");
                return;
            }
            gitRepository.GetGitWrapper().StagePartial(SelectedModifiedFilePathList.First());
        }

        bool CanStageSelectedPartial(object parameter)
        {
            return SelectedModifiedFilePathList.Count() == 1;
        }

        public void OnModifiedDiffCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            List<string> error_msg_list = new List<string>();
            foreach (var filepath in SelectedModifiedFilePathList)
            {
                var file_status = GetModifiedStatus(filepath);
                if (file_status == null)
                {
                    continue;
                }
                if (file_status.Status == "Untracked")
                {
                    string filename = System.IO.Path.Combine(gitRepository.GetGitWrapper().GetPath(), filepath);
                    GlobalSetting.GetInstance().ViewFile(filename);
                    continue;
                }
                gitRepository.AddLog(String.Format("Diff {0}", filepath));
                gitRepository.GetGitWrapper().DiffTool(filepath);
            }

            foreach (string error_msg in error_msg_list)
            {
                UIService.ShowMessage(error_msg);
            }
        }

        public void OnStagedDiffCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            foreach (var filepath in SelectedStagedFilePathList)
            {
                gitRepository.GetGitWrapper().DiffToolStaged(filepath);
            }
        }

        public async void OnUnstageCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            foreach (var filepath in SelectedStagedFilePathList)
            {
                gitRepository.AddLog("Unstage: " + filepath);
            }
            gitRepository.GetGitWrapper().Unstage(SelectedStagedFilePathList, noCommitsYet_);
            await gitRepository.Refresh();
        }

        public async void OnRevertCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            List<string> file_list = new List<string>();
            string msg = "Revert below:\n\n";
            foreach (var item in SelectedModifiedFilePathList)
            {
                file_list.Add(item);
                msg += string.Format("{0}\n", item);
            }
            if (file_list.Count == 0)
            {
                return;
            }
            if (UIService.ConfirmMsg(msg, "Revert") == System.Windows.MessageBoxResult.Cancel)
            {
                return;
            }
            foreach (var item in file_list)
            {
                gitRepository.AddLog("Revert: " + item);
                gitRepository.GetGitWrapper().P4Revert(item);
            }
            await gitRepository.Refresh();
        }

        public void OnOpenExplorerSelectedFileCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            foreach (var item in SelectedModifiedFilePathList)
            {
                string full_path = Path.GetFullPath(Path.Combine(gitRepository.GetRepositoryDirectory(), item));
                string directory_name = System.IO.Path.GetDirectoryName(full_path);
                RunExternal runner = new RunExternal("explorer.exe", directory_name);
                runner.RunWithoutWaiting(string.Format("/select, \"{0}\"", full_path));
            }
        }
        public void OnOpenSelectedFileCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            foreach (var item in SelectedModifiedFilePathList)
            {
                string directory = gitRepository.GetRepositoryDirectory();
                string directory_name = System.IO.Path.GetDirectoryName(directory + "\\" + item);
                RunExternal runner = new RunExternal("explorer.exe", directory_name);
                runner.RunWithoutWaiting(directory + "\\" + item);
            }
        }

        public void OnMergeToolCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            foreach (var item in SelectedModifiedFilePathList)
            {
                gitRepository.GetGitWrapper().MergeTool(item);
            }
        }

        public IEnumerable<string> SelectedModifiedFilePathList {
            get { return ModifiedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
        }

        public IEnumerable<string> SelectedStagedFilePathList {
            get { return StagedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
        }

        public void SetNoCommitsYet(bool val)
        {
            noCommitsYet_ = val;
        }

        private FileStatus GetModifiedStatus(string filepath)
        {
            foreach (var status in ModifiedList)
            {
                if (status.FilePath == filepath)
                {
                    return status;
                }
            }
            return null;
        }
    }
}
