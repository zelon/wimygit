using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Windows.Input;

namespace WimyGit
{
    partial class ViewModel
    {
        public DelegateCommand StageSelected { get; private set; }

        public class FileStatus
        {
            private DelegateCommand stage_selected_command_;
            private bool is_selected_ = false;

            public string Status { get; set; }
            public string FilePath { get; set; }
            public string Display { get; set; }
            public bool IsSelected
            {
                get { return is_selected_; }
                set
                {
                    is_selected_ = value;
                    stage_selected_command_.RaiseCanExecuteChanged();
                }
            }

            public FileStatus(DelegateCommand stage_selected_command)
            {
                stage_selected_command_ = stage_selected_command;
            }
        }

        public System.Collections.ObjectModel.ObservableCollection<FileStatus> ModifiedList { get; set; }
        public System.Collections.ObjectModel.ObservableCollection<FileStatus> StagedList { get; set; }

        private void InitializePending()
        {
            StageSelected = new DelegateCommand(OnStageSelected, CanStageSelected);
            ModifiedDiffCommand = new DelegateCommand(OnModifiedDiffCommand);
            StagedDiffCommand = new DelegateCommand(OnStagedDiffCommand);
            UnstageCommand = new DelegateCommand(OnUnstageCommand);
            CommitCommand = new DelegateCommand(OnCommitCommand);
            RevertCommand = new DelegateCommand(OnRevertCommand);
            OpenExplorerSelectedFileCommand = new DelegateCommand(OnOpenExplorerSelectedFileCommand);
            OpenSelectedFileCommand = new DelegateCommand(OnOpenSelectedFileCommand);

            ModifiedList = new System.Collections.ObjectModel.ObservableCollection<FileStatus>();
            StagedList = new System.Collections.ObjectModel.ObservableCollection<FileStatus>();
        }

        void RefreshPending(List<string> porcelains)
        {
            var modified_backup = new SelectionRecover(ModifiedList);
            var staged_backup = new SelectionRecover(StagedList);
            this.ModifiedList.Clear();
            this.StagedList.Clear();
            foreach (var porcelain in porcelains)
            {
                GitFileStatus status = GitPorcelainParser.ParseFileStatus(porcelain);
                if (status.Staged != null)
                {
                    AddStagedList(status.Staged, staged_backup);
                }
                if (status.Unmerged != null)
                {
                    AddModifiedList(status.Unmerged, modified_backup);
                }
                if (status.Modified != null)
                {
                    AddModifiedList(status.Modified, modified_backup);
                }
            }

            if (ModifiedList.Count == 0 && StagedList.Count == 0)
            {
                AddLog("Nothing changed");
            }
        }

        public ICommand CommitCommand { get; private set; }
        public void OnCommitCommand(object parameter)
        {
            if (String.IsNullOrEmpty(CommitMessage))
            {
                AddLog("Empty commit message. Please fill commit message");
                return;
            }
            if (StagedList.Count == 0)
            {
                AddLog("No staged file");
                return;
            }
            git_.Commit(CommitMessage);
            CommitMessage = "";
            Refresh();
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
        public void OnModifiedDiffCommand(object parameter)
        {
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
                    string filename = System.IO.Path.Combine(Directory, filepath);
                    Service.GetInstance().ViewFile(filename);
                    continue;
                }
                AddLog(String.Format("Diff {0}", filepath));
                git_.DiffTool(filepath);
            }

            foreach (string error_msg in error_msg_list)
            {
                Service.GetInstance().ShowMsg(error_msg);
            }
        }

        public void OnStagedDiffCommand(object parameter)
        {
            foreach (var filepath in SelectedStagedFilePathList)
            {
                git_.DiffToolStaged(filepath);
            }
        }

        public void OnUnstageCommand(object parameter)
        {
            foreach (var filepath in SelectedStagedFilePathList)
            {
                AddLog("Unstage: " + filepath);
            }
            git_.Unstage(SelectedStagedFilePathList);
            Refresh();
        }

        void AddModifiedList(GitFileStatus.Pair git_file_status, SelectionRecover backup_selection)
        {
            FileStatus status = new FileStatus(StageSelected);
            status.Status = git_file_status.Description;
            status.FilePath = git_file_status.Filename;
            status.Display = status.FilePath;
            status.IsSelected = backup_selection.WasSelected(status.FilePath);

            ModifiedList.Add(status);
            PropertyChanged(this, new PropertyChangedEventArgs("ModifiedList"));
        }

        void AddStagedList(GitFileStatus.Pair git_file_status, SelectionRecover backup_selection)
        {
            FileStatus status = new FileStatus(StageSelected);
            status.Status = git_file_status.Description;
            status.FilePath = git_file_status.Filename;
            status.Display = status.FilePath;
            status.IsSelected = backup_selection.WasSelected(status.FilePath);

            StagedList.Add(status);
            PropertyChanged(this, new PropertyChangedEventArgs("StagedList"));
        }

        private string commit_message_;
        public string CommitMessage {
            get {
                return commit_message_;
            }
            set {
                commit_message_ = value;
                NotifyPropertyChanged("CommitMessage");
            }
        }

        public ICommand ModifiedDiffCommand { get; private set; }
        public ICommand StagedDiffCommand { get; private set; }
        public ICommand UnstageCommand { get; private set; }
        public ICommand RevertCommand { get; private set; }
        public ICommand OpenExplorerSelectedFileCommand { get; private set; }
        public ICommand OpenSelectedFileCommand { get; private set; }
        public void OnRevertCommand(object parameter)
        {
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
            if (Service.GetInstance().ConfirmMsg(msg, "Revert") == System.Windows.MessageBoxResult.Cancel)
            {
                return;
            }
            foreach (var item in file_list)
            {
                AddLog("Revert: " + item);
                git_.P4Revert(item);
            }
            Refresh();
        }
        public void OnOpenExplorerSelectedFileCommand(object parameter)
        {
            foreach (var item in SelectedModifiedFilePathList)
            {
                string full_path = Path.GetFullPath(Path.Combine(Directory, item));
                string directory_name = System.IO.Path.GetDirectoryName(full_path);
                RunExternal runner = new RunExternal("explorer.exe", directory_name);
                runner.RunWithoutWaiting(string.Format("/select, \"{0}\"", full_path));
            }
        }
        public void OnOpenSelectedFileCommand(object parameter)
        {
            foreach (var item in SelectedModifiedFilePathList)
            {
                string directory_name = System.IO.Path.GetDirectoryName(Directory + "\\" + item);
                RunExternal runner = new RunExternal("explorer.exe", directory_name);
                runner.RunWithoutWaiting(Directory + "\\" + item);
            }
        }
        void OnStageSelected(object parameter)
        {
            if (SelectedModifiedFilePathList.Count() == 0)
            {
                AddLog("No selected to stage");
                return;
            }
            foreach (var filepath in SelectedModifiedFilePathList)
            {
                AddLog("Stage: " + filepath);
            }

            git_.Stage(SelectedModifiedFilePathList);

            Refresh();
        }

        bool CanStageSelected(object parameter)
        {
            if (SelectedModifiedFilePathList.Count() > 0)
            {
                return true;
            }
            return false;
        }

        public IEnumerable<string> SelectedModifiedFilePathList {
            get { return ModifiedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
        }

        public IEnumerable<string> SelectedStagedFilePathList {
            get { return StagedList.Where(o => o.IsSelected).Select(o => o.FilePath); }
        }
    }
}
