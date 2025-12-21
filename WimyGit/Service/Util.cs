using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Documents;
using WimyGitLib;

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

        public static long GetFileLengthSafe(string filePath)
        {
            try
            {
                var fileInfo = new FileInfo(filePath);
                return fileInfo.Length;
            }
            catch (Exception)
            {
                return -1;
            }
        }

        public static void AppendAnsiToTextBlockWithToneDown(List<AnsiToken> ansiTokens, System.Windows.Controls.TextBlock textBlock)
        {
            foreach (AnsiToken ansiToken in ansiTokens)
            {
                var run = new Run(ansiToken.Text);

                if (ansiToken.Color.HasValue)
                {
                    var toneDownedColor = ConvertColorToneDown(ansiToken.Color.Value);
                    // 흰색 배경 기준이라서 RGB 를 뒤집는다
                    var mediaColor = System.Windows.Media.Color.FromArgb(toneDownedColor.A,
                        toneDownedColor.R, toneDownedColor.G, toneDownedColor.B);
                    run.Foreground = new System.Windows.Media.SolidColorBrush(mediaColor);
                }
                textBlock.Inlines.Add(run);
            }
        }

        public static System.Drawing.Color ConvertColorToneDown(System.Drawing.Color fromColor)
        {
            // 밝기 계산 (perceived brightness)
            float brightness = (fromColor.R * 0.299f + fromColor.G * 0.587f + fromColor.B * 0.114f) / 255f;

            if (brightness > 0.6f) // 너무 밝으면
            {
                // 어둡게 조정 (약 30% 정도로)
                float factor = 0.3f / brightness;
                return System.Drawing.Color.FromArgb(
                    (int)(fromColor.R * factor),
                    (int)(fromColor.G * factor),
                    (int)(fromColor.B * factor)
                );
            }

            return fromColor;
        }
    }
}
