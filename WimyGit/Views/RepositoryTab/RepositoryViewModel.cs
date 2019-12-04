﻿using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows.Input;

namespace WimyGit.ViewModels
{
    public partial class RepositoryViewModel : NotifyBase, ILogger, IGitRepository
	{
		private RepositoryTab repository_tab_;
		public GitWrapper git_;
        public DirectoryTreeViewModel DirectoryTree { get; private set; }
        public HistoryTabViewModel HistoryTabMember { get; private set; }
        public UserControls.StashTabViewModel StashTabViewModel { get; private set; }
        public UserControls.BranchAndTagTabViewModel BranchAndTagTabViewModel_ { get; private set; }
        public Views.CustomTabHeader PendingTabHeader { get; set; }
        public Views.CustomTabHeader HistoryTabHeader { get; set; }
        public Views.CustomTabHeader StashTabHeader { get; set; }
        private bool noCommitsYet_ = false;

        public RepositoryViewModel(string git_repository_path, RepositoryTab repository_tab, UserControls.BranchAndTagTabViewModel branchAndTagTabViewModel)
		{
            DisplayAuthor = GlobalSetting.GetInstance().GetSignature();
            Directory = git_repository_path;

			git_ = new GitWrapper(Directory, this);

            DirectoryTree = new DirectoryTreeViewModel(this);
            HistoryTabMember = new HistoryTabViewModel(git_, this);
            StashTabViewModel = new UserControls.StashTabViewModel(this);
            BranchAndTagTabViewModel_ = branchAndTagTabViewModel;

            PendingTabHeader = new Views.CustomTabHeader("Pending");
            HistoryTabHeader = new Views.CustomTabHeader("History");
            StashTabHeader = new Views.CustomTabHeader("Stash");

			repository_tab_ = repository_tab;

			InitializePending();

			PushCommand = new DelegateCommand((object parameter) => Push());
			RefreshCommand = new DelegateCommand(async (object parameter) => {
				await Refresh();
			});
			ViewTimelapseCommand = new DelegateCommand((object parameter) => ViewTimeLapse());
			FetchAllCommand = new DelegateCommand((object parameter) => FetchAll());
			PullCommand = new DelegateCommand(Pull);
		}

        public string GetRepositoryPath()
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

        public string SelectedPath { get; set; }

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
            DoGitWithProgressWindow("fetch --all");
		}

		public Task DoWithProgressWindow(string filename, string cmd)
		{
			// http://stackoverflow.com/questions/2796470/wpf-create-a-dialog-prompt
			var console_progress_window = new ConsoleProgressWindow(Directory, filename, cmd);
			console_progress_window.Owner = GlobalSetting.GetInstance().GetWindow();
			console_progress_window.ShowDialog();
			return Refresh();
		}

        public async void DoGitWithProgressWindow(string cmd)
        {
            await DoWithProgressWindow(ProgramPathFinder.GetGitBin(), cmd);
        }

		public void Pull(object not_used)
		{
            DoGitWithProgressWindow("pull");
		}

		public void Push()
		{
            DoGitWithProgressWindow("push");
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

            List<string> stashListResult = git_.StashList();
            StashTabViewModel.SetOutput(stashListResult);
            if (stashListResult.Count > 0)
            {
                StashTabHeader.SetTitle($"Stash [{stashListResult.Count}]");
            }
            else
            {
                StashTabHeader.SetTitle("Stash");
            }
            NotifyPropertyChanged("StashTabTitle");

            List<string> git_porcelain_result = await git_.GetGitStatusPorcelainAllAsync();
            RefreshPending(git_porcelain_result);
            DirectoryTree.ReloadTreeView();
            BranchAndTagTabViewModel_.OnRefreshCommand(this);

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
            noCommitsYet_ = gitRepositoryStatus.branchInfo.NoCommitsYet;
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

        public ICommand RefreshCommand { get; private set; }
		public ICommand ViewTimelapseCommand { get; private set; }
		public ICommand FetchAllCommand { get; private set; }
		public ICommand PullCommand { get; private set; }
		public ICommand PushCommand { get; private set; }

		public string Directory { get; set; }
		public string Log { get; set; }
		public string Branch { get; set; }
		public string DisplayAuthor { get; set; }
	}
}
