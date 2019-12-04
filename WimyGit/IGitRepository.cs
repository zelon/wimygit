
namespace WimyGit
{
    public interface IGitRepository
    {
        public GitWrapper GetGitWrapper();
        public System.Threading.Tasks.Task<bool> Refresh();
        public RunExternal CreateGitRunner();
    }
}
