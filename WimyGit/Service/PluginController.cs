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
                data.IconPath = @"..\Images\Vim.png";
                data.Command = "gvim.exe";
                data.Argument = ".gitignore";
                data.ExecutionType = ExecutionType.kWithoutShellAndNoWaiting;

                output.Add(data);
            }
            // temp data2
            {
                PluginData data = new PluginData();
                data.Title = "git status";
                data.IconPath = @"..\Images\Extension.png";
                data.Command = "git.exe";
                data.Argument = "status --untracked-files=all";
                data.ExecutionType = ExecutionType.kWimyGitInnerShellAndRefreshRepositoryStatus;

                output.Add(data);
            }
            // temp data3
            {
                PluginData data = new PluginData();
                data.Title = "Run VS Code";
                data.IconPath = @"..\Images\VsCode.png";
                data.Command = "cmd.exe";
                data.Argument = " /c code .";
                data.ExecutionType = ExecutionType.kWithoutShellAndNoWaiting;

                output.Add(data);
            }
            return output;
        }
    }

    public enum ExecutionType
    {
        kWithoutShellAndNoWaiting,
        kKeepShellAndNoWaiting,
        kWimyGitInnerShellAndRefreshRepositoryStatus,
    }

    public class PluginData
    {
        public PluginData()
        {
            ExecutionType = ExecutionType.kWithoutShellAndNoWaiting;
        }

        public string Title { get; set; }
        public string IconPath { get; set; }
        public string Command { get; set; }
        public string Argument { get; set; }
        public bool ShowShell { get; set; }
        public ExecutionType ExecutionType { get; set; }
    }
}
