using System.Collections.Generic;

namespace WimyGitLib
{
    public class GitIgnore
    {
        public static void AddToGitIgnore(string gitRootPath, string gitFilePath)
        {
            string gitIgnorePath = System.IO.Path.Combine(gitRootPath, ".gitignore");
            System.IO.File.AppendAllLines(gitIgnorePath, new List<string> { gitFilePath });
        }
    }
}
