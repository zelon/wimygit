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
        public PluginData(string xml_filename)
        {
            XmlDocument document = new XmlDocument();
            document.Load(xml_filename);

            Title = document["wimygit_plugin"]["title"].InnerText;
            IconPath = document["wimygit_plugin"]["icon"]["path"].InnerText;
            Command = document["wimygit_plugin"]["command"].InnerText;
            Argument = document["wimygit_plugin"]["arguments"]["argument"]["value"].InnerText;
            ExecutionType = (ExecutionType)System.Enum.Parse(typeof(ExecutionType), document["wimygit_plugin"]["execution_type"].InnerText);
        }

        public string Title { get; private set; }
        public string IconPath { get; private set; }
        public string Command { get; private set; }
        public string Argument { get; private set; }
        public bool ShowShell { get; private set; }
        public ExecutionType ExecutionType { get; private set; }
    }
}
