using System.Collections.ObjectModel;
using System.IO;
using System.Net.Http;
using System.Windows;
using System.Xml;

namespace WimyGit.Views
{
    public class PluginManagerViewModel : NotifyBase
    {
        private const string PluginListUrl = "https://raw.githubusercontent.com/zelon/wimygit-plugins/main/WimygitPlugins.xml";
        private PluginInfo _selectedPluginUrl;
        private ObservableCollection<PluginInfo> _pluginUrls = [];

        public DelegateCommand OpenPluginManualLinkCommand { get; private set; }
        public DelegateCommand ShowPluginFolderInExplorerCommand { get; private set; }
        public DelegateCommand InstallCommand { get; private set; }

        public PluginManagerViewModel()
        {
            InstallCommand = new DelegateCommand(ExecuteInstall, CanExecuteInstall);
            OpenPluginManualLinkCommand = new DelegateCommand(ShowHelpHowToInstallPlugin);
            ShowPluginFolderInExplorerCommand = new DelegateCommand(ShowPluginFolderInExplorer);
            LoadPluginList();
        }

        private void ShowHelpHowToInstallPlugin(object sender)
        {
            Util.OpenUrlLink("https://github.com/zelon/wimygit/wiki/How-to-install-a-plugin");
        }

        private void ShowPluginFolderInExplorer(object sender)
        {
            string pluginRootDirectory = Plugin.PluginController.GetPluginRootDirectoryPath();
            RunExternal runner = new RunExternal("explorer.exe", pluginRootDirectory);
            runner.RunWithoutWaiting(pluginRootDirectory);
        }

        private bool CanExecuteInstall(object parameter)
        {
            return SelectedPluginUrl != null;
        }

        private void ExecuteInstall(object parameter)
        {
            try
            {
                string git_bin = ProgramPathFinder.GetGitBin();
                string dest_path = Plugin.PluginController.GetPluginRootDirectoryPath();
                Directory.CreateDirectory(dest_path);

                RunExternal runner = new RunExternal(git_bin, dest_path);
                runner.RunInConsoleProgressWindow($"clone {SelectedPluginUrl.Url}");
            }
            catch (FileNotFoundException ex)
            {
                UIService.ShowMessage(ex.Message);
            }
        }

        private async void LoadPluginList()
        {
            try
            {
                using (HttpClient client = new HttpClient())
                {
                    string content = await client.GetStringAsync(PluginListUrl);

                    XmlDocument document = new XmlDocument();
                    document.LoadXml(content);

                    var pluginNodes = document.SelectNodes("//wimygit-plugins/plugin");
                    foreach (XmlNode pluginNode in pluginNodes)
                    {
                        var nameNode = pluginNode.SelectSingleNode("name");
                        var urlNode = pluginNode.SelectSingleNode("url");
                        if (nameNode != null && !string.IsNullOrWhiteSpace(nameNode.InnerText) &&
                            urlNode != null && !string.IsNullOrWhiteSpace(urlNode.InnerText))
                        {
                            PluginUrls.Add(new PluginInfo() { Name = nameNode.InnerText.Trim(), Url = urlNode.InnerText.Trim() });
                        }
                    }
                }
            }
            catch (HttpRequestException ex)
            {
                UIService.ShowMessage($"Failed to download plugin list: {ex.Message}");
            }
        }

        public ObservableCollection<PluginInfo> PluginUrls
        {
            get => _pluginUrls;
            set
            {
                _pluginUrls = value;
                NotifyPropertyChanged("PluginUrls");
            }
        }

        public PluginInfo SelectedPluginUrl
        {
            get => _selectedPluginUrl;
            set
            {
                _selectedPluginUrl = value;
                NotifyPropertyChanged("SelectedPluginUrl");
                InstallCommand.RaiseCanExecuteChanged();
            }
        }

        public class PluginInfo
        {
            public string Name { get; set; }
            public string Url { get; set; }
        }
    }
}
