using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Controls;
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
        private readonly TabItem _workspaceTabItem;
        private readonly TabItem _quickDiffTabItem;

        private Service.QuickDiffBuilder _deferQuickDiffBuilder;

        public RepositoryViewModel(string git_repository_path, RepositoryTab repository_tab,
            UserControls.PendingTabViewModel pendingTabViewModel,
            UserControls.StashTabViewModel stashTabViewModel,
            UserControls.BranchTabViewModel branchTabViewModel,
            UserControls.TagTabViewModel tagTabViewModel,
            UserControls.RemoteTabViewModel remoteTabViewModel,
            TabItem workspaceTabItem, TabItem quickDiffTabItem, RichTextBox quickDiffRichTextBox)
        {
            DisplayAuthor = GlobalSetting.GetInstance().GetSignature();
            Directory = git_repository_path;

            git_ = new GitWrapper(Directory, this);


            DirectoryTree = new DirectoryTreeViewModel(this);
            QuickDiffViewModel = new QuickDiffViewModel(quickDiffRichTextBox);
            _workspaceTabItem = workspaceTabItem;
            _quickDiffTabItem = quickDiffTabItem;

            HistoryTabMember = new HistoryTabViewModel(this);
            _pendingTabViewModel = pendingTabViewModel;
            _stashTabViewModel = stashTabViewModel;
            _branchTabViewModel = branchTabViewModel;
            _tagTabViewModel = tagTabViewModel;
            _remoteTabViewModel = remoteTabViewModel;

            StashTabHeader = "Stash";

            repository_tab_ = repository_tab;

            PushCommand = new DelegateCommand((object parameter) => OnPushCommand());
            PushTagCommand = new DelegateCommand((object parameter) => OnPushTagCommand());
            OpenExplorerCommand = new DelegateCommand(OnOpenExplorerCommand);
            OpenGitBashCommand = new DelegateCommand(OnOpenGitBashCommand);
            SwapFocusWorkspaceAndQuickDiffTabCommand = new DelegateCommand(OnSwapFocusWorkspaceAndQuickDiffTabCommand);
            OpenQuickDiffTabCommand = new DelegateCommand(OnOpenQuickDiffTabCommand);
            OpenPendingTabCommand = new DelegateCommand(OnOpenPendingTabCommand);
            OpenHistoryTabCommand = new DelegateCommand(OnOpenHistoryTabCommand);
            RefreshCommand = new DelegateCommand(async (object parameter) => await Refresh());
            TestCommand = new DelegateCommand((object parameter) => OnTestCommand());
            ViewTimelapseCommand = new DelegateCommand((object parameter) => OnViewTimeLapseCommand());
            FetchAllCommand = new DelegateCommand(async (object parameter) => await OnFetchAllCommand());
            PullCommand = new DelegateCommand(async (object parameter) => await OnPullCommand());
            GitCleanDryCommand = new DelegateCommand(async (object parameter) =>
            {
                string cmd = "clean -f -d -n";
                CreateGitRunner().RunInConsoleProgressWindow(cmd);
                await Refresh();
            });
            GitCleanCommand = new DelegateCommand(async (object parameter) =>
            {
                string cmd = "clean -f -d";
                CreateGitRunner().RunInConsoleProgressWindow(cmd);
                await Refresh();
            });
        }

        public GitWrapper git_;

        public DirectoryTreeViewModel DirectoryTree { get; private set; }
        public QuickDiffViewModel QuickDiffViewModel { get; private set; }
        public HistoryTabViewModel HistoryTabMember { get; private set; }
        public string StashTabHeader { get; set; }

        public ICommand RefreshCommand { get; private set; }
        public ICommand ViewTimelapseCommand { get; private set; }
        public ICommand FetchAllCommand { get; private set; }
        public ICommand PullCommand { get; private set; }
        public ICommand GitCleanDryCommand { get; private set; }
        public ICommand GitCleanCommand { get; private set; }
        public ICommand PushCommand { get; private set; }
        public ICommand PushTagCommand { get; private set; }
        public ICommand OpenExplorerCommand { get; private set; }
        public ICommand OpenGitBashCommand { get; private set; }
        public ICommand SwapFocusWorkspaceAndQuickDiffTabCommand { get; private set; }
        public ICommand OpenQuickDiffTabCommand { get; private set; }
        public ICommand OpenPendingTabCommand { get; private set; }
        public ICommand OpenHistoryTabCommand { get; private set; }

        public ICommand TestCommand { get; private set; }

        public string Directory { get; set; }
        public string Log { get; set; }
        public string Branch { get; set; }
        public string Info { get; set; }
        public string DisplayAuthor { get; set; }

        public string SelectedPath { get; set; }

        private int _workspaceTabIndex;
        public int WorkspaceTabIndex
        {
            get => _workspaceTabIndex;
            set
            {
                if (_workspaceTabIndex != value)
                {
                    _workspaceTabIndex = value;
                    NotifyPropertyChanged("WorkspaceTabIndex");

                    // QuickDiffItem tab index is 1
                    if (_workspaceTabIndex == 1)
                    {
                        if (_deferQuickDiffBuilder != null)
                        {
                            var (resultDisplayPrefix, lines) = _deferQuickDiffBuilder.Build();
                            QuickDiffViewModel.SetRichText(resultDisplayPrefix, lines);
                        }
                    }
                }
            }
        }

        public bool IsDebugBuild
        {
            get
            {
#if DEBUG
                return true;
#else
                return false;
#endif
            }
        }

        public string GetRepositoryDirectory()
        {
            return Directory;
        }

        public string GetFullPath(string relativePath)
        {
            return System.IO.Path.Combine(Directory, relativePath);
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

        public void OnViewTimeLapseCommand()
        {
            if (string.IsNullOrEmpty(SelectedPath))
            {
                UIService.ShowMessage("Select a file first");
                return;
            }
            git_.ViewTimeLapse(SelectedPath);
        }

        public void OnTestCommand()
        {
            AddLog("Test button clicked");
        }

        public async Task OnFetchAllCommand()
        {
            string cmd = "fetch --all";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            await Refresh();
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

        private void OnSwapFocusWorkspaceAndQuickDiffTabCommand(object sender)
        {
            if (_quickDiffTabItem.IsSelected)
            {
                _workspaceTabItem.Focus();
            }
            else
            {
                _quickDiffTabItem.Focus();
            }
        }

        private void OnOpenQuickDiffTabCommand (object sender)
        {
            _quickDiffTabItem.Focus();
        }

        private void OnOpenPendingTabCommand (object sender)
        {
            TabItem pendingTab = (TabItem)repository_tab_.tabControl.Items[0];
            pendingTab.Focus();
        }

        private void OnOpenHistoryTabCommand (object sender)
        {
            TabItem historyTab = (TabItem)repository_tab_.tabControl.Items[1];
            historyTab.Focus();
        }

        private async Task OnPullCommand()
        {
            string cmd = "pull";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            await Refresh();
        }

        private async void OnPushCommand()
        {
            string cmd = "push";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            await Refresh();
        }

        private async void OnPushTagCommand()
        {
            string cmd = "push --tags";
            CreateGitRunner().RunInConsoleProgressWindow(cmd);
            await Refresh();
        }

        public async Task<bool> Refresh()
        {
            DateTime start = DateTime.Now;
            AddLog("Refreshing Directory: " + Directory);
            repository_tab_.EnterLoadingScreen();

            if (RefreshBranch() == false)
            {// invalid repository
                repository_tab_.LeaveLoadingScreen();
                repository_tab_.EnterFailedScreen();
                git_ = null;
                return false;
            }

            DirectoryTree.ReloadTreeView();

            Task<List<string>> git_porcelain_result = git_.GetGitStatusPorcelainAllAsync();
            Task<int> stashTabResult = _stashTabViewModel.RefreshAndGetStashCount();
            Task branchTabResult = _branchTabViewModel.Refresh();
            Task tagTabResult = _tagTabViewModel.Refresh();
            Task remoteTabResult = _remoteTabViewModel.Refresh();

            _pendingTabViewModel.RefreshPending(await git_porcelain_result);

            int stashListCount = await stashTabResult;
            if (stashListCount > 0)
            {
                StashTabHeader = $"Stash [{stashListCount}]";
            }
            else
            {
                StashTabHeader = "Stash";
            }
            NotifyPropertyChanged("StashTabHeader");
            await branchTabResult;
            await remoteTabResult;
            await tagTabResult;

            repository_tab_.LeaveLoadingScreen();

            TimeSpan elapsed = DateTime.Now - start;
            AddLog($"Refreshed elapsed: {elapsed.TotalMilliseconds}");
            return true;
        }

        private bool RefreshBranch()
        {
            if (git_ == null)
            {
                return false;
            }
            GitRepositoryStatus gitRepositoryStatus = git_.GetRepositoryStatus();
            if (gitRepositoryStatus == null)
            {
                return false;
            }
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

            if (string.IsNullOrEmpty(gitRepositoryStatus.rebaseOnCommitId) == false)
            {
                Info = $"Rebase in progress onto {gitRepositoryStatus.rebaseOnCommitId}";
                foreach (var line in gitRepositoryStatus.wholeLines)
                {
                    Info += "\n" + line;
                }
            } else
            {
                Info = "";
            }
            NotifyPropertyChanged("Info");

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

        public bool IsQuickDiffTabSelected()
        {
            return _quickDiffTabItem.IsSelected;
        }

        public void SetQuickDiffBuilder(Service.QuickDiffBuilder quickDiffBuilder)
        {
            _deferQuickDiffBuilder = quickDiffBuilder;
            if (IsQuickDiffTabSelected())
            {
                var (resultDisplayPrefix, lines) = _deferQuickDiffBuilder.Build();
                QuickDiffViewModel.SetRichText(resultDisplayPrefix, lines);
            }
        }
    }
}
