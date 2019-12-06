using System;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace WimyGit.UserControls
{
    public class BranchAndTagTabViewModel : NotifyBase
    {
        private WeakReference<IGitRepository> _gitRepository;

        public ICommand RefreshCommand { get; private set; }

        public ICommand DeleteBranchCommand { get; private set; }
        public ICommand DeleteTagCommand { get; private set; }

        public ObservableCollection<BranchInfo> BranchInfos { get; set; }
        public BranchInfo SelectedBranch { get; set; }

        public ObservableCollection<TagInfo> TagInfos { get; set; }
        public TagInfo SelectedTag { get; set; }

        public BranchAndTagTabViewModel()
        {
            RefreshCommand = new DelegateCommand(OnRefreshCommand);
            DeleteBranchCommand = new DelegateCommand(OnDeleteBranchCommand);
            DeleteTagCommand = new DelegateCommand(OnDeleteTagCommand);

            BranchInfos = new ObservableCollection<BranchInfo>();
            TagInfos = new ObservableCollection<TagInfo>();
        }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public void OnRefreshCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out var gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return;
            }

            BranchInfos.Clear();
            string cmd = GitCommandCreator.ListBranch();
            foreach (var branchInfo in BranchParser.Parse(gitRepository.CreateGitRunner().Run(cmd)))
            {
                BranchInfos.Add(branchInfo);
            }
            NotifyPropertyChanged("BranchInfos");

            TagInfos.Clear();
            cmd = GitCommandCreator.ListTag();
            foreach (var tagInfo in TagParser.Parse(gitRepository.CreateGitRunner().Run(cmd)))
            {
                TagInfos.Add(tagInfo);
            }
            NotifyPropertyChanged("TagInfos");
        }

        public void OnDeleteBranchCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out var gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return;
            }
            if (SelectedBranch == null)
            {
                return;
            }
            string branchName = SelectedBranch.Name;
            string cmd = GitCommandCreator.DeleteBranch(branchName);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(cmd);

            gitRepository.Refresh();
        }

        public void OnDeleteTagCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out var gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return;
            }
            if (SelectedTag == null)
            {
                return;
            }
            string tagName = SelectedTag.Name;
            string cmd = GitCommandCreator.DeleteTag(tagName);
            gitRepository.CreateGitRunner().RunInConsoleProgressWindow(cmd);

            gitRepository.Refresh();
        }
    }
}
