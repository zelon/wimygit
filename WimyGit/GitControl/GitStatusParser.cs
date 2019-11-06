using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace WimyGit
{
    public static class GitStatusParser
    {
        public static GitRepositoryStatus Parse(List<string> results)
        {
            if (results.Count <= 0 || results[0].StartsWith("fatal"))
            {
                return null;
            }
            GitRepositoryStatus gitRepositoryStatus = new GitRepositoryStatus();
            gitRepositoryStatus.branchInfo = ParseBranchInfo(results);
            gitRepositoryStatus.IsOnBisecting = ParseBisectInfo(results);

            return gitRepositoryStatus;
        }

        private static BranchInfo ParseBranchInfo(List<string> results)
        {
            BranchInfo branchInfo = new BranchInfo();
            var branchNameRegex = new Regex("On branch (.*)");
            Match match = null;
            foreach (string line in results)
            {
                match = branchNameRegex.Match(line);
                if (match.Success)
                {
                    branchInfo.CurrentBranchName = match.Groups[1].ToString();
                }
            }
            var noCommitsYetRegex = new Regex("No commits yet");
            branchInfo.NoCommitsYet = false;
            foreach (string line in results)
            {
                match = noCommitsYetRegex.Match(line);
                if (match.Success)
                {
                    branchInfo.NoCommitsYet = true;
                }
            }

            var up_to_date_regex = new Regex("Your branch is up to date");
            var ahead_regex = new Regex("Your branch is ahead.*by (.*) commit");
            var behind_regex = new Regex("Your branch is behind.*by (.*) commit");
            foreach (string line in results)
            {
                match = up_to_date_regex.Match(line);
                if (match.Success)
                {
                    branchInfo.BranchTrackingRemoteStatus = "up to date";
                    break;
                }
                match = ahead_regex.Match(line);
                if (match.Success)
                {
                    branchInfo.BranchTrackingRemoteStatus = string.Format("{0} commit ahead", match.Groups[1]);
                    break;
                }
                match = behind_regex.Match(line);
                if (match.Success)
                {
                    branchInfo.BranchTrackingRemoteStatus = string.Format("{0} commit behind", match.Groups[1]);
                    break;
                }
            }
            return branchInfo;
        }
        
        private static bool ParseBisectInfo(List<string> results)
        {
            BranchInfo branchInfo = new BranchInfo();
            var branchNameRegex = new Regex("You are currently bisecting");
            foreach (string line in results)
            {
                Match match = branchNameRegex.Match(line);
                if (match.Success)
                {
                    return true;
                }
            }
            return false;
        }
    }
}
