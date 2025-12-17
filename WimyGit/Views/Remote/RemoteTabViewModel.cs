using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using WimyGitLib;

namespace WimyGit.UserControls
{
    public class RemoteTabViewModel : NotifyBase
    {
        public ICommand DeleteRemoteCommand { get; private set; }

        private WeakReference<IGitRepository> _gitRepository;

        public RemoteTabViewModel()
        {
            RemoteInfos = new ObservableCollection<RemoteInfo>();

            DeleteRemoteCommand = new DelegateCommand(OnDeleteRemoteCommand);
        }

        public ObservableCollection<RemoteInfo> RemoteInfos { get; set; }
        public RemoteInfo SelectedRemoteInfo { get; set; }

        public IGitRepository GitRepo { get; set; }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
            GitRepo = gitRepository;
        }

        public async Task Refresh()
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            RemoteInfos.Clear();

            string cmd = GitCommandCreator.ListRemote();
            List<string> lines = await gitRepository.CreateGitRunner().RunAsync(cmd);
            List<RemoteInfo> remoteInfos = RemoteParser.Parse(lines);
            foreach (RemoteInfo remoteInfo in remoteInfos)
            {
                RemoteInfos.Add(remoteInfo);
            }
            NotifyPropertyChanged("RemoteInfos");
        }

        async void OnDeleteRemoteCommand(object parameter)
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            if (SelectedRemoteInfo == null)
            {
                return;
            }
            string remoteName = SelectedRemoteInfo.Name;
            if (UIService.ShowMessageWithOKCancel($"Are you sure you want to delete the remote '{remoteName}'?") != System.Windows.MessageBoxResult.OK)
            {
                return;
            }
            gitRepository.CreateGitRunner().Run($"remote remove {remoteName}");
            await gitRepository.Refresh();
        }
    }
}
