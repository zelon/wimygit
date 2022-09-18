
namespace WimyGit
{
    public interface IGitRepository
    {
        public string GetRepositoryDirectory();
        public GitWrapper GetGitWrapper();
        public System.Threading.Tasks.Task<bool> Refresh();
        public RunExternal CreateGitRunner();
        public void AddLog(string message);
        public void AddLog(System.Collections.Generic.List<string> logs);
        public bool NeedToSetQuickDiff();
        public void SetQuickDiff(string content);
    }
}
