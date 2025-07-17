using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace WimyGit.Service
{
    class GitDiffCollector
    {
        public static async Task<List<string>> CollectStageDiffAsync(string gitRepositoryPath)
        {
            try
            {
                // Execute the git diff command
                string command = $"diff --staged";
                var runExternal = new RunExternal(ProgramPathFinder.GetGitBin(), gitRepositoryPath);
                List<string> output = await runExternal.RunAsync(command);
                return output;
            }
            catch (Exception ex)
            {
                // Handle exceptions, such as git not found or command execution failure
                Console.WriteLine($"Error collecting staged diff: {ex.Message}");
            }
            return new List<string>();
        }
    }
}
