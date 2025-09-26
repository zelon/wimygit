using System.Collections.ObjectModel;
using System.IO;
using System.Net.Http;
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
        public DelegateCommand UpdateCommand { get; private set; }
        public DelegateCommand UninstallCommand { get; private set; }

        public PluginManagerViewModel()
        {
            InstallCommand = new DelegateCommand(ExecuteInstall);
            UpdateCommand = new DelegateCommand(ExecuteUpdate);
            UninstallCommand = new DelegateCommand(ExecuteUninstall);
            OpenPluginManualLinkCommand = new DelegateCommand(ShowHelpHowToInstallPlugin);
            ShowPluginFolderInExplorerCommand = new DelegateCommand(ShowPluginFolderInExplorer);
            LoadPluginList();
        }

        public bool NeedToShowInstallButtons
        {
            get
            {
                if (SelectedPluginUrl != null && IsPluginInstalled() == false)
                {
                    return true;
                }
                return false;
            }
        }

        public bool NeedToShowUpdateAndUninstallButtons
        {
            get
            {
                if (SelectedPluginUrl != null && IsPluginInstalled())
                {
                    return true;
                }
                return false;
            }
        }

        private bool IsPluginInstalled()
        {
            if (SelectedPluginUrl == null)
            {
                return false;
            }
            string pluginDirectoryPath = GetPluginDirectoryPath(SelectedPluginUrl.Url);
            return Directory.Exists(pluginDirectoryPath);
        }

        private string GetPluginDirectoryPath(string pluginUrl)
        {
            if (string.IsNullOrEmpty(pluginUrl))
            {
                return null;
            }
            string pluginRootDirectory = Plugin.PluginController.GetPluginRootDirectoryPath();
            string pluginDirectoryName = Path.GetFileNameWithoutExtension(pluginUrl);
            return Path.Combine(pluginRootDirectory, pluginDirectoryName);
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

        private void ExecuteInstall(object parameter)
        {
            try
            {
                string git_bin = ProgramPathFinder.GetGitBin();
                string dest_path = Plugin.PluginController.GetPluginRootDirectoryPath();
                Directory.CreateDirectory(dest_path);

                RunExternal runner = new RunExternal(git_bin, dest_path);
                runner.RunInConsoleProgressWindow($"clone {SelectedPluginUrl.Url}");

                UIService.ShowMessage("Plugin has been installed. It will be applied after restarting the wimygit");

                NotifyPropertyChanged("NeedToShowInstallButtons");
                NotifyPropertyChanged("NeedToShowUpdateAndUninstallButtons");
            }
            catch (FileNotFoundException ex)
            {
                UIService.ShowMessage(ex.Message);
            }
        }

        private void ExecuteUpdate(object parameter)
        {
            try
            {
                if (SelectedPluginUrl == null)
                {
                    UIService.ShowMessage("Plugin is not selected.");
                    return;
                }
                string pluginDir = GetPluginDirectoryPath(SelectedPluginUrl.Url);
                if (string.IsNullOrEmpty(pluginDir) || Directory.Exists(pluginDir) == false)
                {
                    UIService.ShowMessage("Plugin is not installed.");
                    return;
                }
                string git_bin = ProgramPathFinder.GetGitBin();
                RunExternal runner = new RunExternal(git_bin, pluginDir);
                runner.RunInConsoleProgressWindow($"pull");
            }
            catch (FileNotFoundException ex)
            {
                UIService.ShowMessage(ex.Message);
            }
        }

        private void ExecuteUninstall(object parameter)
        {
            try
            {
                if (SelectedPluginUrl == null)
                {
                    UIService.ShowMessage("Plugin is not selected.");
                    return;
                }
                string pluginDir = GetPluginDirectoryPath(SelectedPluginUrl.Url);
                if (string.IsNullOrEmpty(pluginDir) || Directory.Exists(pluginDir) == false)
                {
                    UIService.ShowMessage("Plugin is not installed.");
                    return;
                }
                DeleteDirectoryForce(pluginDir);
                UIService.ShowMessage("Plugin has been uninstalled. It will be applied after restarting the wimygit");
                NotifyPropertyChanged("NeedToShowInstallButtons");
                NotifyPropertyChanged("NeedToShowUpdateAndUninstallButtons");
            }
            catch (System.UnauthorizedAccessException ex)
            {
                UIService.ShowMessage($"Failed to uninstall plugin: {ex.Message}");
            }
            catch (FileNotFoundException ex)
            {
                UIService.ShowMessage(ex.Message);
            }
        }

        void DeleteDirectoryForce(string targetDir)
        {
            foreach (string file in Directory.GetFiles(targetDir, "*", SearchOption.AllDirectories))
            {
                File.SetAttributes(file, FileAttributes.Normal);
            }

            Directory.Delete(targetDir, true);
        }

        private async void LoadPluginList()
        {
            try
            {
                using (HttpClient client = new())
                {
                    string content = await client.GetStringAsync(PluginListUrl);

                    XmlDocument document = new();
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
                NotifyPropertyChanged("NeedToShowInstallButtons");
                NotifyPropertyChanged("NeedToShowUpdateAndUninstallButtons");
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
