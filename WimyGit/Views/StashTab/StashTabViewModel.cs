using System;
using System.Collections.Generic;
using System.Windows.Input;


namespace WimyGit.UserControls
{
    public class StashTabViewModel : NotifyBase
    {
        readonly public WeakReference<IGitRepository> _gitRepository;
        public ICommand PushAllCommand { get; private set; }
        public ICommand PopLastCommand { get; private set; }
        public string Output { get; set; }

        public StashTabViewModel(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
            PushAllCommand = new DelegateCommand(OnSaveCommand);
            PopLastCommand = new DelegateCommand(OnPopLastCommand);
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
            gitRepository.GetGitWrapper().StashPushAll(stashMessage);

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

        public void SetOutput(List<string> outputs)
        {
            Output = "";
            foreach (string output in outputs)
            {
                Output += $"{output}\n";
            }
            NotifyPropertyChanged("Output");
        }
    }
}
