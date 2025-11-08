using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace WimyGitLib
{
    public class RemoteParser
    {
        private static readonly Regex RemoteRegex = new Regex(@"(\S+)\s+(\S+)\s+(\S+)", RegexOptions.Compiled);

        public static List<RemoteInfo> Parse(List<string> lines)
        {
            List<RemoteInfo> output = new List<RemoteInfo>();
            foreach (string line in lines)
            {
                RemoteInfo RemoteInfo = ParseLine(line);
                if (RemoteInfo != null)
                {
                    output.Add(RemoteInfo);
                }
            }
            return output;
        }

        public static RemoteInfo ParseLine(string line)
        {
            RemoteInfo RemoteInfo = new RemoteInfo();

            Match match = RemoteRegex.Match(line);
            if (match.Success == false)
            {
                return null;
            }
            RemoteInfo.Name = match.Groups[1].Value;
            RemoteInfo.Url = match.Groups[2].Value;
            RemoteInfo.Mirror = match.Groups[3].Value;

            return RemoteInfo;
        }
    }
}
