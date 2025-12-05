using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;

namespace WimyGit.UserControls
{
    public class BranchTabViewModel : NotifyBase
    {
        private WeakReference<IGitRepository> _gitRepository;

        public BranchTabViewModel()
        {
            DeleteBranchCommand = new DelegateCommand(OnDeleteBranchCommand);
            SwitchBranchCommand = new DelegateCommand(OnSwitchBranchCommand);
            BranchInfos = new ObservableCollection<WimyGitLib.BranchInfo>();
        }

        public ObservableCollection<WimyGitLib.BranchInfo> BranchInfos { get; set; }
        public WimyGitLib.BranchInfo SelectedBranch { get; set; }

        public ICommand SwitchBranchCommand { get; private set; }
        public ICommand DeleteBranchCommand { get; private set; }

        public void SetGitRepository (IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public async Task Refresh()
        {
            if (_gitRepository.TryGetTarget(out var gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return;
            }

            BranchInfos.Clear();
            string cmd = GitCommandCreator.ListBranch();
            foreach (var branchInfo in WimyGitLib.BranchParser.Parse(await gitRepository.CreateGitRunner().RunAsync(cmd)))
            {
                BranchInfos.Add(branchInfo);
            }
            NotifyPropertyChanged("BranchInfos");
        }

        public void OnSwitchBranchCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return;
            }
            if (SelectedBranch == null)
            {
                return;
            }
            string branchName = SelectedBranch.Name;
            string cmd = GitCommandCreator.SwitchBranch(branchName);
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);

            gitRepository.Refresh();
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
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);

            gitRepository.Refresh();
        }
    }
}
