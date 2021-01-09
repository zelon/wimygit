using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace WimyGitLib
{
    public class BranchInfo
    {
        public bool IsCurrent { get; set; }
        public string Name { get; set; }
        public string CommitId { get; set; }
    }

    public static class BranchParser
    {
        public static List<BranchInfo> Parse(List<string> lines)
        {
            List<BranchInfo> output = new List<BranchInfo>();
            foreach (string line in lines)
            {
                BranchInfo branchInfo = ParseLine(line);
                output.Add(branchInfo);
            }
            return output;
        }

        public static BranchInfo ParseLine(string line)
        {
            Regex regex = new Regex(@"([\s\*])\s(\S+)\s+(\S+)");
            BranchInfo branchInfo = new BranchInfo();

            Match match = regex.Match(line);
            if (match.Success == false)
            {
                return null;
            }
            branchInfo.IsCurrent = (match.Groups[1].Value == "*");
            branchInfo.Name = match.Groups[2].Value;
            branchInfo.CommitId = match.Groups[3].Value;

            return branchInfo;
        }
    }
}
