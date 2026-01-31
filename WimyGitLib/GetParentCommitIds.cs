using System;
using System.Collections.Generic;

namespace WimyGitLib
{
    public class GetParentCommitIds
    {
        public static string GetCommand(string commitId)
        {
            return $"log --pretty=format:%P -n 1 {commitId}";
        }

        public static List<string> Get(RunExternal runner, string commitId)
        {
            List<string> parentCommitIds = new List<string>();
            string cmd = GetCommand(commitId);
            List<string> outputLines = runner.Run(cmd);
            if (outputLines.Count > 0)
            {
                string line = outputLines[0];
                string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string part in parts)
                {
                    parentCommitIds.Add(part);
                }
            }
            return parentCommitIds;
        }
    }
}
