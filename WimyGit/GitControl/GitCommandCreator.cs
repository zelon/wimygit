
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
    }
}
