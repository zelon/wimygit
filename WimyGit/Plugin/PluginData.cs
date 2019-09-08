using System.Xml;

namespace WimyGit.Plugin
{
    public enum ExecutionType
    {
        WithoutShellAndNoWaiting,
        KeepShellAndNoWaiting,
        WimyGitInnerShellAndRefreshRepositoryStatus,
    }

    public class PluginData
    {
        public static PluginData CreateFromXmlFile(string xml_filename)
        {
            XmlDocument document = new XmlDocument();
            document.Load(xml_filename);

            string title = document["wimygit_plugin"]["title"].InnerText;
            string iconPath = document["wimygit_plugin"]["icon"]["path"].InnerText;
            string command = document["wimygit_plugin"]["command"].InnerText;
            string argument = document["wimygit_plugin"]["arguments"]["argument"]["value"].InnerText;
            ExecutionType executionType = (ExecutionType)System.Enum.Parse(typeof(ExecutionType), document["wimygit_plugin"]["execution_type"].InnerText);

            return new PluginData(title, iconPath, command, argument, executionType);
        }

        public PluginData(string title, string iconPath, string command, string argument, ExecutionType executionType)
        {
            Title = title;
            IconPath = iconPath;
            Command = command;
            Argument = argument;
            ExecutionType = executionType;
        }

        public string Title { get; private set; }
        public string IconPath { get; private set; }
        public string Command { get; private set; }
        public string Argument { get; private set; }
        public bool ShowShell { get; private set; }
        public ExecutionType ExecutionType { get; private set; }
    }
}
