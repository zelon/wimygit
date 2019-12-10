
namespace WimyGit
{
    public static class GitCommandCreator
    {
        static private readonly string kEmptyTreeCommitId = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

        public static string GetLastCommitMessage()
        {
            return $"log --max-count=1 --pretty=%B HEAD";
        }

        public static string ListBranch()
        {
            return "branch --list --verbose";
        }

        public static string SwitchBranch(string branchName)
        {
            return $"checkout \"{branchName}\"";
        }

        public static string DeleteBranch(string branchName)
        {
            return $"branch --delete \"{branchName}\"";
        }

        public static string ListTag()
        {
            return "tag --list --format=%(objectname:short=7)@%(refname:lstrip=2)";
        }

        public static string DeleteTag(string tagName)
        {
            return $"tag --delete \"{tagName}\"";
        }

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
            return $"diff --name-status {stashName} {stashName}^1";
        }

        public static string StashUntrackedFileListWithCommitId(string stashName)
        {
            return $"show --name-status --pretty=oneline {stashName}^3";
        }

        public static string StashDiff(string stashName)
        {
            return $"diff {stashName}";
        }

        public static string StashDiffToolAgainstWorkingFileModified(string stashName, string filename)
        {
            return $"difftool {stashName} -- \"{filename}\"";
        }

        public static string StashDiffToolAgainstWorkingFileUntracked(string stashName, string filename)
        {
            return $"difftool {stashName}^3 -- \"{filename}\"";
        }

        public static string StashDiffToolAgainstParentModified(string stashName, string filename)
        {
            return $"difftool {stashName}^ {stashName} -- {filename}";
        }

        public static string StashDiffToolAgainstParentUntracked(string stashName, string filename)
        {
            return $"difftool {kEmptyTreeCommitId} {stashName}^3 -- \"{filename}\"";
        }

        public static string StashDiffToolAgainstHEAD(string stashName, string filename)
        {
            return $"difftool HEAD {stashName} -- \"{filename}\"";
        }

        public static string ApplyStash(string stashName)
        {
            return $"stash apply \"{stashName}\"";
        }

        public static string DeleteStash(string stashName)
        {
            return $"stash drop \"{stashName}\"";
        }

        public static string Checkout(string commitId)
        {
            return $"checkout {commitId}";
        }

        public static string ResetSoft(string commitId)
        {
            return $"reset --soft {commitId}";
        }

        public static string ResetMixed(string commitId)
        {
            return $"reset --mixed {commitId}";
        }

        public static string ResetHard(string commitId)
        {
            return $"reset --hard {commitId}";
        }

        public static string ListRemote()
        {
            return "remote --verbose";
        }

        public static string GetRemoteDetail(string remoteName)
        {
            return $"remote --verbose show \"{remoteName}\"";
        }
    }
}
