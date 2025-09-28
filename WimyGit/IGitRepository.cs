
namespace WimyGit
{
    public interface IGitRepository
    {
        public string GetRepositoryDirectory();
        public string GetFullPath(string filename);
        public GitWrapper GetGitWrapper();
        public System.Threading.Tasks.Task<bool> Refresh();
        public RunExternal CreateGitRunner();
        public void AddLog(string message);
        public void AddLog(System.Collections.Generic.List<string> logs);
        public bool IsQuickDiffTabSelected();
        public void SetQuickDiffBuilder(Service.QuickDiffBuilder quickDiffBuilder);
    }
}
