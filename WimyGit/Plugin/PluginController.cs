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
            _pluginDatas = new List<PluginData>();

            string[] directory_names = Directory.GetDirectories(GetPluginRootDirectoryPath());
            foreach (string directory_name in directory_names)
            {
                try
                {
                    string xml_filename = Path.Combine(directory_name, "Plugin.xml");
                    _pluginDatas.Add(new PluginData(xml_filename));
                }
                catch (System.Exception exception)
                {
                    WimyGit.GlobalSetting.GetInstance().ShowMsg(string.Format("Cannot load plugin,{0},{1}", directory_name, exception.Message));
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
