using System.Collections.Generic;
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
            string iconType = document["wimygit_plugin"]["icon"]["type"].InnerText;
            string iconPath = "";
            if (iconType == "embedded")
            {
                iconPath = "../../Images/" + document["wimygit_plugin"]["icon"]["path"].InnerText;
            } else if (iconType == "plugin_directory")
            {
                string pluginDirectory = System.IO.Path.GetDirectoryName(xml_filename);
                iconPath = System.IO.Path.Combine(pluginDirectory, document["wimygit_plugin"]["icon"]["path"].InnerText);
            }
            
            string command = document["wimygit_plugin"]["command"].InnerText;
            List<PluginArgument> arguments = new List<PluginArgument>();
            foreach (XmlElement argumentElement in document["wimygit_plugin"]["arguments"].ChildNodes)
            {
                string type = argumentElement["type"].InnerText;
                string value = argumentElement["value"].InnerText;

                if (type == "string")
                {
                    arguments.Add(new PluginArgument(PluginArgument.Type.String, value));
                } else if (type == "inputbox")
                {
                    // not implemented
                } else if (type == "repository_directory")
                {
                    arguments.Add(new PluginArgument(PluginArgument.Type.RepositoryDirectory, value));
                }
            }
            ExecutionType executionType = (ExecutionType)System.Enum.Parse(typeof(ExecutionType), document["wimygit_plugin"]["execution_type"].InnerText);

            return new PluginData(title, iconPath, command, arguments, executionType);
        }

        public PluginData(string title, string iconPath, string command, List<PluginArgument> arguments, ExecutionType executionType)
        {
            Title = title;
            IconPath = iconPath;
            Command = command;
            Arguments = arguments;
            ExecutionType = executionType;
        }

        public string Title { get; private set; }
        public string IconPath { get; private set; }
        public string Command { get; private set; }
        public List<PluginArgument> Arguments { get; private set; }
        public bool ShowShell { get; private set; }
        public ExecutionType ExecutionType { get; private set; }
    }
}
