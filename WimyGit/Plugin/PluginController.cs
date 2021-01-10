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
        private static string DefaultExtensionIconPath = @"..\..\Images\Extension.png";
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
            List<PluginArgument> argumentInfos = new List<PluginArgument>();
            argumentInfos.Add(new PluginArgument(PluginArgument.Type.String, "remote -v show"));
            return new Plugin.PluginData(
                title: "RemoteInfo",
                iconPath: DefaultExtensionIconPath,
                command: "git",
                arguments: argumentInfos,
                executionType: Plugin.ExecutionType.WimyGitInnerShellAndRefreshRepositoryStatus);
        }

        public static void AddToolbarButton(PluginData pluginData, ToolBar toolBar, IGitRepository gitRepository)
        {
            Button button = new Button();
            button.Width = 100;
            StackPanel stackPanel = new StackPanel();
            stackPanel.Orientation = Orientation.Vertical;

            BitmapImage bitmapImage = null;
            try
            {
                bitmapImage = new BitmapImage(new Uri(pluginData.IconPath, UriKind.RelativeOrAbsolute));
            }
            catch
            {
                bitmapImage = new BitmapImage(new Uri(DefaultExtensionIconPath, UriKind.RelativeOrAbsolute));
            }
            Image image = new Image();
            image.Source = bitmapImage;
            image.Width = 48;
            image.Height = 48;

            TextBlock textBlock = new TextBlock();
            textBlock.HorizontalAlignment = HorizontalAlignment.Center;
            textBlock.Text = pluginData.Title;

            stackPanel.Children.Add(image);
            stackPanel.Children.Add(textBlock);

            button.Content = stackPanel;

            button.Command = new DelegateCommand(async (object parameter) =>
            {
                string workingDirectory = gitRepository.GetRepositoryDirectory();
                string arguments = PluginArgument.ToArgumentString(pluginData.Arguments, gitRepository.GetRepositoryDirectory());

                switch (pluginData.ExecutionType)
                {
                    case ExecutionType.WithoutShellAndNoWaiting:
                        {
                            RunExternal runner = new RunExternal(pluginData.Command, workingDirectory);
                            try
                            {
                                runner.RunWithoutWaiting(arguments);
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
                                runner.RunInConsoleProgressWindow(arguments);
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
