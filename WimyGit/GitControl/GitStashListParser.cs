using System.Diagnostics;

namespace WimyGit
{
    public struct StashInfo
    {
        public string Name { get; set; }
        public string Marker { get; set; }
        public string Description { get; set; }
    }

    public static class GitStashListParser
    {
        public static StashInfo Parse(string line)
        {
            string[] splitted = line.Split(":");
            StashInfo stashInfo = new StashInfo();
            if (splitted.Length == 3)
            {
                stashInfo.Name = splitted[0].Trim();
                stashInfo.Marker = splitted[1].Trim();
                stashInfo.Description = splitted[2].Trim();
            }
            else
            {
                Debug.Assert(false);

                stashInfo.Name = line;
                stashInfo.Marker = "";
                stashInfo.Description = "";
            }
            return stashInfo;
        }
    }
}
