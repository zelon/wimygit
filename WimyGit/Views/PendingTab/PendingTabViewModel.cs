using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Input;
using TestCSharp;
using WimyGit.Service;
using WimyGitLib;

namespace WimyGit.UserControls
{
    public class PendingTabViewModel : NotifyBase
    {
        public IGitRepository GetGitRepository()
        {
            return _gitRepository.TryGetTarget(out IGitRepository gitRepository) ? gitRepository : null;
        }

        public ObservableCollection<FileStatus> ModifiedList { get; set; }
        public ObservableCollection<FileStatus> StagedList { get; set; }

        public ICommand SelectAllCommand { get; private set; }
        public DelegateCommand StageSelectedCommand { get; private set; }
        public DelegateCommand StageSelectedPartialCommand { get; private set; }
        public ICommand AmendClickedCommand { get; private set; }
        public ICommand CommitCommand { get; private set; }
        public ICommand GetCommitMessageFromAICommand { get; private set; }
        public ICommand ModifiedDiffCommand { get; private set; }
        public ICommand StagedDiffCommand { get; private set; }
        public ICommand UnstageCommand { get; private set; }
        public ICommand RevertCommand { get; private set; }
        public ICommand OpenExplorerSelectedFileCommand { get; private set; }
        public ICommand OpenSelectedFileCommand { get; private set; }
        public ICommand MergeToolCommand { get; private set; }
        public ICommand DeleteLocalFileCommand { get; private set; }

        public Action OnSelectAllCallbackViewSide;
        
        public bool ShowAICommitMessageButton
        {
            get
            {
                return String.IsNullOrEmpty(GlobalSetting.GetInstance().ConfigModel.GoogleGeminiApiKey) == false;
            }
        }

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
            GetCommitMessageFromAICommand = new DelegateCommand(OnGetCommitMessageFromAICommand);
            RevertCommand = new DelegateCommand(OnRevertCommand);
            OpenExplorerSelectedFileCommand = new DelegateCommand(OnOpenExplorerSelectedFileCommand);
            OpenSelectedFileCommand = new DelegateCommand(OnOpenSelectedFileCommand);
            MergeToolCommand = new DelegateCommand(OnMergeToolCommand);
            DeleteLocalFileCommand = new DelegateCommand(OnDeleteLocalFileCommand);

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
            if (StagedList.Count == 0)
            {
                UIService.ShowMessage("No staged file");
                return;
            }
            if (String.IsNullOrEmpty(CommitMessage))
            {
                UIService.ShowMessage("Empty commit message");
                return;
            }
            gitRepository.GetGitWrapper().Commit(CommitMessage, IsAmendCommit);
            CommitMessage = "";
            IsAmendCommit = false;
            NotifyPropertyChanged("IsAmendCommit");
            await gitRepository.Refresh();
        }

        public async void OnGetCommitMessageFromAICommand(object parameter)
        {
            var googleGeminiApiKey = GlobalSetting.GetInstance().ConfigModel.GoogleGeminiApiKey;
            if (string.IsNullOrEmpty(googleGeminiApiKey))
            {
                UIService.ShowMessage("Google Gemini API key is not set. Please set it in the settings.");
                return;
            }
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                UIService.ShowMessage("Invalid git repository");
                return;
            }
            if (StagedList.Count == 0)
            {
                UIService.ShowMessage("No staged file");
                return;
            }
            if (String.IsNullOrEmpty(CommitMessage) == false)
            {
                UIService.ShowMessage("NOT Empty commit message. Clear commit message at first");
                return;
            }

            List<string> outputs = await GitDiffCollector.CollectStageDiffAsync(gitRepository.GetRepositoryDirectory());
            GeminiAI geminiAI = new GeminiAI(googleGeminiApiKey, "You are a super senior programmer.");
            StringBuilder promptBuilder = new StringBuilder();
            promptBuilder.AppendLine("Recommend a git commit message. Below is the git diff.");
            foreach (string output in outputs)
            {
                promptBuilder.AppendLine(output);
            }
            CommitMessage = await geminiAI.GetGeminiAIResponse(promptBuilder.ToString());
            NotifyPropertyChanged("CommitMessage");
            UIService.ShowMessage("Commit Message has been updated");
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
                if (file_status.Status == Constants.Untracked)
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
            int kMinimumShowFilenameCount = 20;
            var file_list = ModifiedList.Where(o => o.IsSelected).ToList();
            string msg = "Revert below:\n\n";
            for (int i = 0; i < file_list.Count; ++i)
            {
                if (i < kMinimumShowFilenameCount)
                {
                    msg += $"{file_list[i].FilePath}\n";
                }
                else if (i == kMinimumShowFilenameCount)
                {
                    msg += "...";
                    break;
                }
            }

            if (file_list.Count == 0)
            {
                return;
            }
            if (MessageBox.Show(msg, "Revert", MessageBoxButton.OKCancel, MessageBoxImage.Warning) == System.Windows.MessageBoxResult.Cancel)
            {
                return;
            }
            List<string> logs = new List<string>();
            List<string> filesToCheckout = new List<string>();
            foreach (var fileStatus in file_list)
            {
                if (fileStatus.Status == Constants.Untracked)
                {
                    string fullPath = gitRepository.GetFullPath(fileStatus.FilePath);
                    try
                    {
                        File.Delete(fullPath);
                        logs.Add("Deleted: " + fileStatus.FilePath);
                    }
                    catch (Exception ex)
                    {
                        logs.Add($"Failed to delete {fileStatus.FilePath}: {ex.Message}");
                        UIService.ShowMessage($"Failed to delete {fileStatus.FilePath}: {ex.Message}");
                    }
                }
                else
                {
                    filesToCheckout.Add(fileStatus.FilePath);
                }
            }

            if (filesToCheckout.Any())
            {
                string command = gitRepository.GetGitWrapper().P4Revert(filesToCheckout);
                logs.Add($"Command: {command}");
            }
            gitRepository.AddLog(logs);
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

        public async void OnDeleteLocalFileCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            FileStatus fileStatus = (FileStatus)parameter;
            if (fileStatus == null)
            {
                return;
            }
            string fullPath = gitRepository.GetFullPath(fileStatus.FilePath);
            if (MessageBox.Show($"Delete local file: {fullPath}?", "Delete Local File", MessageBoxButton.OKCancel, MessageBoxImage.Warning) == System.Windows.MessageBoxResult.Cancel)
            {
                return;
            }
            File.Delete(fullPath);
            await gitRepository.Refresh();
        }

        private void QuickDiff(string item, FileStatus fileStatus, string displayPrefix, string diffCommandPrefix)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (fileStatus == null)
            {
                return;
            }

            bool isItemDirectory = Directory.Exists(Path.Combine(gitRepository.GetGitWrapper().GetPath(), item));
            QuickDiffBuilder quickDiffBuilder;
            if (isItemDirectory)
            {
                bool isModule = Directory.Exists(Path.Combine(gitRepository.GetGitWrapper().GetPath(), item, ".git"));
                string displayMessage = displayPrefix;
                List<string> rawBody = null;
                if (isModule)
                {
                    displayMessage += "[MODULE] ";
                    rawBody = new List<string> { "This is a git submodule. Quick diff for submodules is not supported yet." };
                }
                else
                {
                    displayMessage += "[DIRECTORY] ";
                    rawBody = new List<string> { "This is a directory" };
                }
                displayMessage += item;
                quickDiffBuilder = new QuickDiffBuilder(gitRepository,
                    displayMessage,
                    /* newFilePath= */ null,
                    diffCommand: null,
                    rawBody: rawBody);
            }
            else
            {
                string filePath = Path.Combine(gitRepository.GetGitWrapper().GetPath(), item);

                const long maxFileSizeInBytes = 10 * 1024 * 1024; // 10 MB
                long fileSizeInBytes = Util.GetFileLengthSafe(filePath);
                if (fileSizeInBytes >= maxFileSizeInBytes)
                {
                    List<string> rawBody = new List<string>
                    {
                        $"File size {fileSizeInBytes / (1024 * 1024)} MB exceeds the maximum limit of {maxFileSizeInBytes / (1024 * 1024)} MB for quick diff.",
                        "Please use an external diff tool to view the changes."
                    };
                    quickDiffBuilder = new QuickDiffBuilder(gitRepository,
                        displayPrefix + "[TOO_LARGE_FILE] " + item,
                        /* newFilePath= */ null,
                        diffCommand: null,
                        rawBody: rawBody);
                }
                else
                {
                    if (fileStatus.Status == Constants.Untracked // ModifiedList
                        || fileStatus.Status == "Added in stage") // StagedList
                    {
                        quickDiffBuilder = new QuickDiffBuilder(gitRepository,
                            displayPrefix,
                            filePath,
                            diffCommand: null);
                    }
                    else
                    {
                        quickDiffBuilder = new QuickDiffBuilder(gitRepository,
                            displayPrefix,
                            /* newFilePath= */ null,
                            diffCommand: diffCommandPrefix + Util.WrapFilePath(item));
                    }
                }
            }
            gitRepository.SetQuickDiffBuilder(quickDiffBuilder);
        }

        public void OnUnstagedFilesSelectionChanged()
        {
            if (SelectedModifiedFilePathList.Count() != 1)
            {
                return;
            }
            foreach (var item in SelectedModifiedFilePathList)
            {
                QuickDiff(item, GetModifiedStatus(item), "[UNSTAGED]", diffCommandPrefix: "diff -- ");
            }
        }

        public void OnStagedFilesSelectionChanged()
        {
            if (SelectedStagedFilePathList.Count() != 1)
            {
                return;
            }
            foreach (var item in SelectedStagedFilePathList)
            {
                QuickDiff(item, GetStagedStatus(item), "[STAGED]", diffCommandPrefix: "diff --cached -- ");
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

        private FileStatus GetStagedStatus(string filepath)
        {
            foreach (var status in StagedList)
            {
                if (status.FilePath == filepath)
                {
                    return status;
                }
            }
            return null;
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
