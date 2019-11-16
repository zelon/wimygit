
namespace WimyGit
{
    public class StashedFileInfo
    {
        public enum StashedFileType
        {
            kModified,
            kUntracked
        }
        public StashedFileType FileType { get; set; }
        public string Status { get; set; }
        public string Filename { get; set; }
    }
}
