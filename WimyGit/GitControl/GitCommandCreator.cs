
using System;

namespace WimyGit
{
    public static class GitCommandCreator
    {
        static private readonly string kEmptyTreeCommitId = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

        public static string StashList()
        {
            return "stash list";
        }

        public static string StashPushAll(string message)
        {
            string command = "stash push --include-untracked";
            if (string.IsNullOrEmpty(message) == false)
            {
                command += $" --message \"{message}\"";
            }
            return command;
        }

        public static string StashPopLast()
        {
            return "stash pop";
        }

        public static string StashModifiedFileList(string stashName)
        {
            return $"diff --name-status {stashName}";
        }

        public static string StashUntrackedFileListWithCommitId(string stashName)
        {
            return $"show --name-status --pretty=oneline {stashName}^3";
        }

        public static string StashDiff(string stashName)
        {
            return $"diff {stashName}";
        }

        public static string StashDiffToolAgainstWorkingTree(string stashName, string filename)
        {
            return $"difftool {stashName} -- {filename}";
        }

        public static string StashDiffToolAgainstParentModified(string stashName, string filename)
        {
            return $"difftool {stashName}^ {stashName} -- {filename}";
        }

        public static string StashDiffToolAgainstParentUntracked(string stashName, string filename)
        {
            return $"difftool {kEmptyTreeCommitId} {stashName}^3 -- {filename}";
        }

        public static string StashDiffToolAgainstHEAD(string stashName, string filename)
        {
            return $"difftool HEAD {stashName} -- {filename}";
        }

        public static string Checkout(string commitId)
        {
            return $"checkout {commitId}";
        }

        public static string ResetSoft(string commitId)
        {
            return $"reset --soft {commitId}";
        }

        public static string ResetHard(string commitId)
        {
            return $"reset --hard {commitId}";
        }
    }
}
