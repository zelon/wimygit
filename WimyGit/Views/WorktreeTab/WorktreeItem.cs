namespace WimyGit.UserControls
{
    public class WorktreeItem
    {
        public string Path { get; set; }
        public string CommitHash { get; set; }
        public string Branch { get; set; }
        public bool IsMain { get; set; }
        public string IsMainMark => IsMain ? "●" : "";
        public string Locked { get; set; }
    }
}
