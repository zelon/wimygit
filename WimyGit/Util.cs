using System.Diagnostics;
using System.IO;

namespace WimyGit
{
    public static class Util
    {
        public static string WrapFilePath(string filename)
        {
            Debug.Assert(string.IsNullOrEmpty(filename) == false);

            if (filename.StartsWith("\""))
            {
                return filename;
            }
            return string.Format("\"{0}\"", filename);
        }

        public static string GetRepositoryName(string repository_path)
        {
            Debug.Assert(string.IsNullOrEmpty(repository_path) == false);

            var path_list = repository_path.Split(Path.DirectorySeparatorChar);
            for (int i=path_list.Length - 1; i>=0; --i)
            {
                if (string.IsNullOrEmpty(path_list[i]) == false)
                {
                    return path_list[i];
                }
            }
            return repository_path;
        }

        public enum DirectoryCheckResult
        {
            kSuccess = 0,
            kInvalidInput = 1,
            kNotDirectory = 2,
            kNotGitRepository = 3
        }

        public static DirectoryCheckResult CheckDirectory(string directory)
        {
            if (string.IsNullOrEmpty(directory))
            {
                string msg = "Directory is empty";
                Service.GetInstance().ShowMsg(msg);
                return DirectoryCheckResult.kInvalidInput;
            }
            if (System.IO.Directory.Exists(directory) == false)
            {
                string msg = "Directory does not exist";
                Service.GetInstance().ShowMsg(msg);
                return DirectoryCheckResult.kNotDirectory;
            }
            if (LibGit2Sharp.Repository.IsValid(directory) == false)
            {
                string msg = "Directory is not a valid git directory";
                Service.GetInstance().ShowMsg(msg);
                return DirectoryCheckResult.kNotGitRepository;
            }
            return DirectoryCheckResult.kSuccess;
        }
    }
}
