
using System;

namespace WimyGit
{
    public static class GitCommandCreator
    {
        public static string StashList()
        {
            return "stash list";
        }

        public static string StashPushAll(string message)
        {
            string command = "stash push --include-untracked";
            if (string.IsNullOrEmpty(message) == false)
            {
                command += $" --message {message}";
            }
            return command;
        }

        public static string StashPopLast()
        {
            return "stash pop";
        }

        public static string StashFileList(string stashName)
        {
            return $"diff --name-status {stashName}";
        }

        public static string StashDiff(string stashName)
        {
            return $"diff {stashName}";
        }

        public static string StashDiffToolAgainstParent(string stashName, string filename)
        {
            return $"difftool {stashName}^ {stashName} -- {filename}";
        }

        public static string StashDiffToolAgainstHEAD(string stashName, string filename)
        {
            return $"difftool HEAD {stashName} -- {filename}";
        }
    }
}
