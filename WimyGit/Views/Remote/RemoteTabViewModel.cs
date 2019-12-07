using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace WimyGit.UserControls
{
    public class RemoteTabViewModel : NotifyBase
    {
        private WeakReference<IGitRepository> _gitRepository;

        public RemoteTabViewModel()
        {
            RemoteInfos = new ObservableCollection<RemoteInfo>();
        }

        public ObservableCollection<RemoteInfo> RemoteInfos { get; set; }
        public RemoteInfo SelectedRemoteInfo { get; set; }

        public IGitRepository GitRepo { get; set; }

        public void SetGitRepository(IGitRepository gitRepository)
        {
            _gitRepository = new WeakReference<IGitRepository>(gitRepository);
            GitRepo = gitRepository;
        }

        public void Refresh()
        {
            if (_gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                return;
            }
            RemoteInfos.Clear();

            string cmd = GitCommandCreator.ListRemote();
            List<string> lines = gitRepository.CreateGitRunner().Run(cmd);
            List<RemoteInfo> remoteInfos = RemoteParser.Parse(lines);
            foreach (RemoteInfo remoteInfo in remoteInfos)
            {
                RemoteInfos.Add(remoteInfo);
            }
            NotifyPropertyChanged("RemoteInfos");
        }
    }
}
