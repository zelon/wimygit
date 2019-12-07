using System;
using System.Collections.ObjectModel;
using System.Windows.Input;

namespace WimyGit.UserControls
{
    public class BranchTabViewModel : NotifyBase
    {
        private WeakReference<IGitRepository> _gitRepository;

        public BranchTabViewModel()
        {
            DeleteBranchCommand = new DelegateCommand(OnDeleteBranchCommand);
            BranchInfos = new ObservableCollection<BranchInfo>();

        }

        public ObservableCollection<BranchInfo> BranchInfos { get; set; }
        public BranchInfo SelectedBranch { get; set; }

        public ICommand DeleteBranchCommand { get; private set; }

        public void SetGitRepository (IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public void Refresh()
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


    }
}
