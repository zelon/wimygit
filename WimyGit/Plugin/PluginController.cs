using System.Collections.Generic;
using System.IO;

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
    }
}
