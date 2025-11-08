using System;
using System.Text.RegularExpressions;

namespace WimyGitLib
{
    public class DownloadParserResult
    {
        public Version Version { get; set; }
        public string DownloadFilename { get;set; }
    }

    public class DownloadParser
    {
        private static readonly Regex VersionRegex = new Regex(@"http.*wimygit/releases/download/v(\d+\.\d+\.\d+)/(.*)", RegexOptions.Compiled);

        public static DownloadParserResult GetVersionFromDownloadUrl(string url)
        {
            // "https://github.com/zelon/wimygit/releases/download/v1.0.0/WimyGit-1.0.0.zip"
            Match match = VersionRegex.Match(url);
            if (match.Success == false)
            {
                return null;
            }
            return new DownloadParserResult()
            {
                Version = new Version(match.Groups[1].Value),
                DownloadFilename = match.Groups[2].Value
            };
        }
    }
}
