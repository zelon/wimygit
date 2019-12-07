using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Input;

namespace WimyGit.ViewModels
{
    public class RepositoryViewModel : NotifyBase, ILogger, IGitRepository
    {
        private readonly UserControls.PendingTabViewModel _pendingTabViewModel;
        private readonly UserControls.StashTabViewModel _stashTabViewModel;
        private readonly UserControls.BranchTabViewModel _branchTabViewModel;
        private readonly UserControls.TagTabViewModel _tagTabViewModel;
        private readonly UserControls.RemoteTabViewModel _remoteTabViewModel;

        private readonly RepositoryTab repository_tab_;

        public RepositoryViewModel(string git_repository_path, RepositoryTab repository_tab,
            UserControls.PendingTabViewModel pendingTabViewModel,
            UserControls.StashTabViewModel stashTabViewModel,
            UserControls.BranchTabViewModel branchTabViewModel,
            UserControls.TagTabViewModel tagTabViewModel,
            UserControls.RemoteTabViewModel remoteTabViewModel)
        {
            DisplayAuthor = GlobalSetting.GetInstance().GetSignature();
            Directory = git_repository_path;

            git_ = new GitWrapper(Directory, this);

            DirectoryTree = new DirectoryTreeViewModel(this);
            HistoryTabMember = new HistoryTabViewModel(this);
            _pendingTabViewModel = pendingTabViewModel;
            _stashTabViewModel = stashTabViewModel;
            _branchTabViewModel = branchTabViewModel;
            _tagTabViewModel = tagTabViewModel;
            _remoteTabViewModel = remoteTabViewModel;

            StashTabHeader = "Stash";

            repository_tab_ = repository_tab;

            PushCommand = new DelegateCommand((object parameter) => Push());
            OpenExplorerCommand = new DelegateCommand(OnOpenExplorerCommand);
            OpenGitBashCommand = new DelegateCommand(OnOpenGitBashCommand);
            RefreshCommand = new DelegateCommand(async (object parameter) =>
            {
                await Refresh();
            });
            ViewTimelapseCommand = new DelegateCommand((object parameter) => ViewTimeLapse());
            FetchAllCommand = new DelegateCommand((object parameter) => FetchAll());
            PullCommand = new DelegateCommand(Pull);
        }

        public GitWrapper git_;

        public DirectoryTreeViewModel DirectoryTree { get; private set; }
        public HistoryTabViewModel HistoryTabMember { get; private set; }
        public string StashTabHeader { get; set; }

        public ICommand RefreshCommand { get; private set; }
        public ICommand ViewTimelapseCommand { get; private set; }
        public ICommand FetchAllCommand { get; private set; }
        public ICommand PullCommand { get; private set; }
        public ICommand PushCommand { get; private set; }
        public ICommand OpenExplorerCommand { get; private set; }
        public ICommand OpenGitBashCommand { get; private set; }

        public string Directory { get; set; }
        public string Log { get; set; }
        public string Branch { get; set; }
        public string DisplayAuthor { get; set; }

        public string SelectedPath { get; set; }

        public string GetRepositoryDirectory()
        {
            return Directory;
        }

        public GitWrapper GetGitWrapper()
        {
            return git_;
        }

        Task<bool> IGitRepository.Refresh()
        {
            return Refresh();
        }

        public RunExternal CreateGitRunner()
        {
            return new RunExternal(ProgramPathFinder.GetGitBin(), Directory);
        }

        public void ViewTimeLapse()
        {
            if (string.IsNullOrEmpty(SelectedPath))
            {
                MessageBox.ShowMessage("Select a file first");
                return;
            }
            git_.ViewTimeLapse(SelectedPath);
        }

        public void FetchAll()
        {
            string cmd = "fetch --all";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            RefreshAsyncWrapper();
        }

        private void OnOpenExplorerCommand(object sender)
        {
            RunExternal runner = new RunExternal("explorer.exe", Directory);
            runner.RunWithoutWaiting(Directory);
        }

        private void OnOpenGitBashCommand(object sender)
        {
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitShell(), Directory);
            runner.RunInShell("--login -i");
        }

        private void Pull(object not_used)
        {
            string cmd = "pull";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            RefreshAsyncWrapper();
        }

        private void Push()
        {
            string cmd = "push";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            RefreshAsyncWrapper();
        }

        private async void RefreshAsyncWrapper()
        {
            await Refresh();
        }

        public async Task<bool> Refresh()
        {
            AddLog("Refreshing Directory: " + Directory);
            repository_tab_.EnterLoadingScreen();

            if (RefreshBranch() == false)
            {// invalid repository
                repository_tab_.LeaveLoadingScreen();
                repository_tab_.EnterFailedScreen();
                git_ = null;
                return false;
            }

            int stashListCount = _stashTabViewModel.RefreshAndGetStashCount();
            if (stashListCount > 0)
            {
                StashTabHeader = $"Stash [{stashListCount}]";
            }
            else
            {
                StashTabHeader = "Stash";
            }
            NotifyPropertyChanged("StashTabHeader");

            List<string> git_porcelain_result = await git_.GetGitStatusPorcelainAllAsync();
            DirectoryTree.ReloadTreeView();
            _pendingTabViewModel.RefreshPending(git_porcelain_result);
            _branchTabViewModel.Refresh();
            _tagTabViewModel.Refresh();
            _remoteTabViewModel.Refresh();

            AddLog("Refreshed");

            repository_tab_.LeaveLoadingScreen();

            return true;
        }

        private bool RefreshBranch()
        {
            if (git_ == null)
            {
                return false;
            }
            GitRepositoryStatus gitRepositoryStatus = git_.GetRepositoryStatus();
            if (gitRepositoryStatus.branchInfo == null)
            {
                return false;
            }
            _pendingTabViewModel.SetNoCommitsYet(gitRepositoryStatus.branchInfo.NoCommitsYet);
            string currentBranchName = gitRepositoryStatus.branchInfo.CurrentBranchName;
            HistoryTabMember.CurrentBranchName = currentBranchName;
            string output = currentBranchName;
            string ahead_or_behind = gitRepositoryStatus.branchInfo.BranchTrackingRemoteStatus;
            if (string.IsNullOrEmpty(ahead_or_behind) == false)
            {
                output = string.Format("{0} - ({1})", currentBranchName, ahead_or_behind);
            }
            if (gitRepositoryStatus.IsOnBisecting)
            {
                output += " [BISECTING...]";
            }
            Branch = output;

            NotifyPropertyChanged("Branch");

            return true;
        }

        public void AddLog(string log)
        {
            if (string.IsNullOrEmpty(log))
            {
                return;
            }
            Log += String.Format("[{0}] {1}\n", DateTime.Now.ToLocalTime(), log);
            NotifyPropertyChanged("Log");
            repository_tab_.ScrollToEndLogTextBox();
        }

        public void AddLog(List<string> logs)
        {
            Log += string.Format("[{0}] {1}\n", DateTime.Now.ToLocalTime(), string.Join("\n", logs));
            NotifyPropertyChanged("Log");
            repository_tab_.ScrollToEndLogTextBox();
        }
    }
}
