using System;
using System.Collections.Generic;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;

namespace WimyGit.Plugin
{
    public class PluginController
    {
        private static List<PluginData> _pluginDatas = null;

        public static List<PluginData> GetPlugins()
        {
            if (_pluginDatas != null)
            {
                return _pluginDatas;
            }
            string pluginRootDirectoryPath = GetPluginRootDirectoryPath();
            if (Directory.Exists(pluginRootDirectoryPath) == false)
            {
                Directory.CreateDirectory(pluginRootDirectoryPath);
            }
            string[] directory_names = Directory.GetDirectories(pluginRootDirectoryPath);
            _pluginDatas = new List<PluginData>();
            foreach (string directory_name in directory_names)
            {
                try
                {
                    string xml_filename = Path.Combine(directory_name, "Plugin.xml");
                    _pluginDatas.Add(PluginData.CreateFromXmlFile(xml_filename));
                }
                catch (System.Exception exception)
                {
                    UIService.ShowMessage(string.Format("Cannot load plugin,{0},{1}", directory_name, exception.Message));
                }
            }
            return _pluginDatas;
        }

        private static string GetPluginRootDirectoryPath()
        {
            return Path.Combine(Config.ConfigFileController.GetConfigDirectoryPath(), "Plugins");
        }

        public static void ConstructPluginToolbarButtons(ToolBar toolBar, IGitRepository gitRepository)
        {
            // Default Plugins
            {
                AddToolbarButton(CreateGitRemoteShowPlugin(), toolBar, gitRepository);
            }
            foreach (PluginData pluginData in PluginController.GetPlugins())
            {
                AddToolbarButton(pluginData, toolBar, gitRepository);
            }
        }

        public static PluginData CreateGitRemoteShowPlugin()
        {
            return new Plugin.PluginData(
                title: "RemoteInfo",
                iconPath: @"..\..\Images\Extension.png",
                command: "git",
                argument: "remote -v show",
                executionType: Plugin.ExecutionType.WimyGitInnerShellAndRefreshRepositoryStatus);
        }

        public static void AddToolbarButton(PluginData pluginData, ToolBar toolBar, IGitRepository gitRepository)
        {
            Button button = new Button();
            button.Width = 100;
            StackPanel stackPanel = new StackPanel();
            stackPanel.Orientation = Orientation.Vertical;

            BitmapImage bitmapImage = new BitmapImage(new Uri(pluginData.IconPath, UriKind.RelativeOrAbsolute));
            Image image = new Image();
            image.Source = bitmapImage;
            image.Width = 32;
            image.Height = 32;

            TextBlock textBlock = new TextBlock();
            textBlock.HorizontalAlignment = HorizontalAlignment.Center;
            textBlock.Text = pluginData.Title;

            stackPanel.Children.Add(image);
            stackPanel.Children.Add(textBlock);

            button.Content = stackPanel;

            button.Command = new DelegateCommand(async (object parameter) =>
            {
                string workingDirectory = gitRepository.GetRepositoryDirectory();

                switch (pluginData.ExecutionType)
                {
                    case ExecutionType.WithoutShellAndNoWaiting:
                        {
                            RunExternal runner = new RunExternal(pluginData.Command, workingDirectory);
                            try
                            {
                                runner.RunWithoutWaiting(pluginData.Argument);
                            }
                            catch (System.Exception exception)
                            {
                                UIService.ShowMessage("Cannot execute. " + exception.Message);
                            }
                            return;
                        }
                    case ExecutionType.WimyGitInnerShellAndRefreshRepositoryStatus:
                        {
                            RunExternal runner = new RunExternal(pluginData.Command, workingDirectory);
                            try
                            {
                                runner.RunInConsoleProgressWindow(pluginData.Argument);
                                await gitRepository.Refresh();
                            }
                            catch (System.Exception exception)
                            {
                                UIService.ShowMessage("Cannot execute. " + exception.Message);
                            }
                            return;
                        }
                }
            });

            toolBar.Items.Add(button);
        }
    }
}
