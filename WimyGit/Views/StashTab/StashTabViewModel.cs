using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;


namespace WimyGit.UserControls
{
    public class StashTabViewModel : NotifyBase
    {
        public WeakReference<IGitRepository> _gitRepository;

        public ICommand PushAllCommand { get; private set; }
        public ICommand PopLastCommand { get; private set; }
        public ICommand DiffStashedFileAgainstParentCommand { get; private set; }
        public ICommand DiffStashedFileAgainstWorkingFileCommand { get; private set; }
        public ICommand DiffStashedFileAgainstHeadCommand { get; private set; }
        public ICommand ApplyStashCommand { get; private set; }
        public ICommand DeleteStashCommand { get; private set; }

        public ObservableCollection<StashItem> StashItems { get; set; }
        public StashItem SelectedStashItem { get; set; }
        public StashedFileInfo SelectedStashedFileInfo { get; set; }

        public StashTabViewModel()
        {
            PushAllCommand = new DelegateCommand(OnPushAllCommand);
            PopLastCommand = new DelegateCommand(OnPopLastCommand);
            DiffStashedFileAgainstParentCommand = new DelegateCommand(OnDiffStashedFileAgainstParentCommand);
            DiffStashedFileAgainstWorkingFileCommand = new DelegateCommand(OnDiffStashedFileAgainstWorkingFileCommand);
            DiffStashedFileAgainstHeadCommand = new DelegateCommand(OnDiffStashedFileAgainstHeadCommand);
            ApplyStashCommand = new DelegateCommand(OnApplyStashCommand);
            DeleteStashCommand = new DelegateCommand(OnDeleteStashCommand);

            StashItems = new ObservableCollection<StashItem>();
        }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
        }

        public void OnPushAllCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            string stashMessage = UIService.AskAndGetString("Enter stash message", "");
            if (string.IsNullOrEmpty(stashMessage))
            {
                return;
            }
            string cmd = GitCommandCreator.StashPushAll(stashMessage);

            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);
            gitRepository.Refresh();
        }

        public void OnPopLastCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            string cmd = GitCommandCreator.StashPopLast();
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);

            gitRepository.Refresh();
        }

        public void OnDiffStashedFileAgainstParentCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedStashItem == null)
            {
                return;
            }
            if (SelectedStashedFileInfo == null)
            {
                return;
            }
            switch (SelectedStashedFileInfo.FileType)
            {
                case StashedFileInfo.StashedFileType.kModified:
                {
                    gitRepository.GetGitWrapper().StashDiffToolAgainstParentModified(SelectedStashItem.Name, SelectedStashedFileInfo.Filename);
                    return;
                }
                case StashedFileInfo.StashedFileType.kUntracked:
                {
                    gitRepository.GetGitWrapper().StashDiffToolAgainstParentUntracked(SelectedStashItem.Name, SelectedStashedFileInfo.Filename);
                    return;
                }

            }
            System.Diagnostics.Debug.Assert(false, "Not implemented");
        }

        public void OnDiffStashedFileAgainstWorkingFileCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedStashItem == null)
            {
                return;
            }
            if (SelectedStashedFileInfo == null)
            {
                return;
            }
            switch (SelectedStashedFileInfo.FileType)
            {
                case StashedFileInfo.StashedFileType.kModified:
                {
                    string cmd = GitCommandCreator.StashDiffToolAgainstWorkingFileModified(SelectedStashItem.Name, SelectedStashedFileInfo.Filename);
                    gitRepository.CreateGitRunner().RunWithoutWaiting(cmd);
                    return;
                }
                case StashedFileInfo.StashedFileType.kUntracked:
                {
                    string cmd = GitCommandCreator.StashDiffToolAgainstWorkingFileUntracked(SelectedStashItem.Name, SelectedStashedFileInfo.Filename);
                    gitRepository.CreateGitRunner().RunWithoutWaiting(cmd);
                    return;
                }

            }
            System.Diagnostics.Debug.Assert(false, "Not implemented");
        }

        public void OnDiffStashedFileAgainstHeadCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedStashItem == null)
            {
                return;
            }
            if (SelectedStashedFileInfo == null)
            {
                return;
            }
            gitRepository.GetGitWrapper().StashDiffToolAgainstHEAD(SelectedStashItem.Name, SelectedStashedFileInfo.Filename);
        }

        public void OnApplyStashCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedStashItem == null)
            {
                return;
            }
            string cmd = GitCommandCreator.ApplyStash(SelectedStashItem.Name);
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);
            gitRepository.Refresh();
        }

        public void OnDeleteStashCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedStashItem == null)
            {
                return;
            }
            string cmd = GitCommandCreator.DeleteStash(SelectedStashItem.Name);
            UIService.RunInConsoleProgressWindow(gitRepository.CreateGitRunner(), cmd);
            gitRepository.Refresh();
        }

        public async Task<int> RefreshAndGetStashCount()
        {
            StashItems.Clear();
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return 0;
            }
            string cmd = GitCommandCreator.StashList();
            List<string> outputs = await gitRepository.CreateGitRunner().RunAsync(cmd);
            foreach (string line in outputs)
            {
                if (string.IsNullOrEmpty(line.Trim()))
                {
                    continue;
                }
                var parsedResult = GitStashListParser.Parse(line);
                StashItem stashItem = new StashItem();
                stashItem.Name = parsedResult.Name;
                stashItem.Base = parsedResult.Marker;
                stashItem.Description = parsedResult.Description;

                StashItems.Add(stashItem);
            }
            NotifyPropertyChanged("StashItems");

            return StashItems.Count;
        }
    }
}
