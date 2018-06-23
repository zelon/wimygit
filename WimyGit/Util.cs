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
            var path_list = repository_path.Split(Path.DirectorySeparatorChar);
            return path_list[path_list.Length - 1];
        }
    }
}
