using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Windows.Input;


namespace WimyGit.UserControls
{
    public class StashTabViewModel : NotifyBase
    {
        readonly public WeakReference<IGitRepository> _gitRepository;
        public ICommand PushAllCommand { get; private set; }
        public ICommand PopLastCommand { get; private set; }
        public ICommand DiffStashedFileAgainstParentCommand { get; private set; }
        public ICommand DiffStashedFileAgainstHeadCommand { get; private set; }
        public string Output { get; set; }

        public ObservableCollection<StashItem> StashItems { get; set; }
        public StashItem SelectedStashItem { get; set; }
        public StashedFileInfo SelectedStashedFileInfo { get; set; }
        public StashTabViewModel(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
            PushAllCommand = new DelegateCommand(OnSaveCommand);
            PopLastCommand = new DelegateCommand(OnPopLastCommand);
            DiffStashedFileAgainstParentCommand = new DelegateCommand(OnDiffStashedFileAgainstParentCommand);
            DiffStashedFileAgainstHeadCommand = new DelegateCommand(OnDiffStashedFileAgainstHeadCommand);

            StashItems = new ObservableCollection<StashItem>();
        }

        public void OnSaveCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            string stashMessage = Service.UIService.GetInstance().AskAndGetString("Enter stash message", "");
            if (string.IsNullOrEmpty(stashMessage))
            {
                return;
            }
            string cmd = GitCommandCreator.StashPushAll(stashMessage);
            Service.UIService.GetInstance().StartConsoleProgressWindow(_gitRepository, cmd);
            gitRepository.Refresh();
        }

        public void OnPopLastCommand(object sender)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            gitRepository.GetGitWrapper().StashPopLast();

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

        public void SetOutput(List<string> outputs)
        {
            Output = "";
            foreach (string output in outputs)
            {
                Output += $"{output}\n";
            }
            NotifyPropertyChanged("Output");

            StashItems.Clear();
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
        }
    }
}
