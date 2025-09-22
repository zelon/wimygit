﻿using System;
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
			for (int i = path_list.Length - 1; i >= 0; --i)
			{
				if (string.IsNullOrEmpty(path_list[i]) == false)
				{
					return path_list[i];
				}
			}
			return repository_path;
		}

		public static bool IsValidGitDirectory(string directory)
		{
			if (string.IsNullOrEmpty(directory))
			{
				return false;
			}
			if (Directory.Exists(directory) == false)
			{
				return false;
			}
			if (Directory.Exists(Path.Combine(directory, ".git")) == false)
			{
				return false;
			}
			GitWrapper git_wrapper = new GitWrapper(directory, null);
			if (git_wrapper.IsValidGitDirectory() == false)
			{
				return false;
			}
			return true;
		}

        public static Version GetVersion()
        {
            var fileVersionInfo = FileVersionInfo.GetVersionInfo(Environment.ProcessPath);
            Debug.Assert(fileVersionInfo != null);

            var fileVersion = fileVersionInfo.ProductVersion;
            Debug.Assert(fileVersion != null);

            return System.Version.Parse(fileVersion);
        }

        public static void OpenUrlLink(string url)
        {
            Process p = new Process();
            p.StartInfo.UseShellExecute = true;
            p.StartInfo.FileName = url;
            p.Start();
        }
    }
}
