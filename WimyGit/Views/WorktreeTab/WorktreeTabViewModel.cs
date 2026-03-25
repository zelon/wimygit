using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;

namespace WimyGit.UserControls
{
    public class WorktreeTabViewModel : NotifyBase
    {
        private WeakReference<IGitRepository> _gitRepository;

        public ICommand AddWorktreeCommand { get; private set; }
        public ICommand OpenInExplorerCommand { get; private set; }
        public ICommand OpenInNewRepositoryTabCommand { get; private set; }
        public ICommand RemoveWorktreeCommand { get; private set; }

        public ObservableCollection<WorktreeItem> WorktreeItems { get; set; }
        public WorktreeItem SelectedWorktreeItem { get; set; }

        public WorktreeTabViewModel()
        {
            WorktreeItems = new ObservableCollection<WorktreeItem>();

            AddWorktreeCommand = new DelegateCommand(OnAddWorktreeCommand);
            OpenInExplorerCommand = new DelegateCommand(OnOpenInExplorerCommand);
            OpenInNewRepositoryTabCommand = new DelegateCommand(OnOpenInNewRepositoryTabCommand);
            RemoveWorktreeCommand = new DelegateCommand(OnRemoveWorktreeCommand);
        }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public async Task<int> RefreshAndGetWorktreeCount()
        {
            WorktreeItems.Clear();
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return 0;
            }
            string cmd = GitCommandCreator.ListWorktree();
            List<string> lines = await gitRepository.CreateGitRunner().RunAsync(cmd);
            ParseAndFillWorktrees(lines);
            NotifyPropertyChanged("WorktreeItems");
            return WorktreeItems.Count;
        }

        private void ParseAndFillWorktrees(List<string> lines)
        {
            WorktreeItem current = null;
            bool isFirst = true;

            foreach (string line in lines)
            {
                if (string.IsNullOrEmpty(line.Trim()))
                {
                    if (current != null)
                    {
                        WorktreeItems.Add(current);
                        current = null;
                    }
                    continue;
                }

                if (line.StartsWith("worktree "))
                {
                    current = new WorktreeItem();
                    current.Path = System.IO.Path.GetFullPath(line.Substring("worktree ".Length).Trim());
                    current.IsMain = isFirst;
                    current.Locked = "";
                    isFirst = false;
                }
                else if (current != null && line.StartsWith("HEAD "))
                {
                    string fullHash = line.Substring("HEAD ".Length).Trim();
                    current.CommitHash = fullHash.Length >= 7 ? fullHash.Substring(0, 7) : fullHash;
                }
                else if (current != null && line.StartsWith("branch "))
                {
                    string refName = line.Substring("branch ".Length).Trim();
                    const string prefix = "refs/heads/";
                    current.Branch = refName.StartsWith(prefix) ? refName.Substring(prefix.Length) : refName;
                }
                else if (current != null && line == "bare")
                {
                    current.Branch = "(bare)";
                }
                else if (current != null && line == "detached")
                {
                    current.Branch = "(detached)";
                }
                else if (current != null && line.StartsWith("locked"))
                {
                    current.Locked = "Locked";
                }
            }

            // 마지막 항목 (빈 줄 없이 파일 끝난 경우)
            if (current != null)
            {
                WorktreeItems.Add(current);
            }
        }

        private async void OnAddWorktreeCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            List<string> branchLines = await gitRepository.CreateGitRunner().RunAsync(GitCommandCreator.GetCurrentBranch());
            string currentBranch = branchLines.Count > 0 ? branchLines[0].Trim() : "";
            var result = Views.NewWorktreeWindow.NewWindow(currentBranch, out string path, out string branch, out bool isNewBranch);
            if (result != System.Windows.MessageBoxResult.OK)
            {
                return;
            }
            string cmd = isNewBranch
                ? GitCommandCreator.AddWorktreeWithNewBranch(path, branch)
                : GitCommandCreator.AddWorktree(path, branch);
            gitRepository.AddGitCommandLog(cmd);
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);
            await gitRepository.Refresh();
        }

        private void OnOpenInExplorerCommand(object sender)
        {
            if (SelectedWorktreeItem == null)
            {
                return;
            }
            var runner = new WimyGitLib.RunExternal("explorer.exe", SelectedWorktreeItem.Path);
            runner.RunWithoutWaiting(SelectedWorktreeItem.Path);
        }

        private void OnOpenInNewRepositoryTabCommand(object sender)
        {
            if (SelectedWorktreeItem == null)
            {
                return;
            }
            var mainWindow = GlobalSetting.GetInstance().GetWindow() as MainWindow;
            mainWindow?.HandleDirectoryArgument(SelectedWorktreeItem.Path);
        }

        private async void OnRemoveWorktreeCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedWorktreeItem == null)
            {
                return;
            }
            if (SelectedWorktreeItem.IsMain)
            {
                UIService.ShowMessage("Cannot remove the main worktree.");
                return;
            }
            string path = SelectedWorktreeItem.Path;
            if (UIService.ShowMessageWithOKCancel($"Are you sure you want to remove the worktree at '{path}'?") != System.Windows.MessageBoxResult.OK)
            {
                return;
            }
            string cmd = GitCommandCreator.RemoveWorktree(path);
            gitRepository.CreateGitRunner().Run(cmd);
            await gitRepository.Refresh();
        }
    }
}
