using System.Collections.Generic;

namespace WimyGit.UserControls
{
    public class TagInfo
    {
        public string Name { get; set; }
        public string CommitId { get; set; }
    }

    public static class TagParser
    {
        public static List<TagInfo> Parse(List<string> lines)
        {
            List<TagInfo> output = new List<TagInfo>();
            foreach (string line in lines)
            {
                TagInfo TagInfo = ParseLine(line);
                output.Add(TagInfo);
            }
            return output;
        }

        public static TagInfo ParseLine(string line)
        {
            TagInfo TagInfo = new TagInfo();

            string[] splitted = line.Split("@");

            TagInfo.CommitId = splitted[0];
            TagInfo.Name = splitted[1];

            return TagInfo;
        }
    }
}
