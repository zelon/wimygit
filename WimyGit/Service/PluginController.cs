using System.Collections.Generic;

namespace WimyGit.Service
{
    public class PluginController
    {
        public static List<PluginData> GetPlugins()
        {
            List<PluginData> output = new List<PluginData>();

            // temp data
            {
                PluginData data = new PluginData();
                data.Title = "Edit gitignore";
                data.IconPath = @"C:\git\WimyGit\WimyGit\Images\Pull.png";
                data.Command = "gvim.exe";
                data.Argument = ".gitignore";
                data.ExecutionType = ExecutionType.kWithoutShell;

                output.Add(data);
            }

            return output;
        }
    }

    public enum ExecutionType
    {
        kWithoutShell,
        kWimyGitInnerShellAndRefreshRepositoryStatus,
        kWithShellAndWaitAnyKey,
        kKeepShell,
    }

    public class PluginData
    {
        public PluginData()
        {
            ExecutionType = ExecutionType.kWithoutShell;
        }

        public string Title { get; set; }
        public string IconPath { get; set; }
        public string Command { get; set; }
        public string Argument { get; set; }
        public bool ShowShell { get; set; }
        public ExecutionType ExecutionType { get; set; }
    }
}
