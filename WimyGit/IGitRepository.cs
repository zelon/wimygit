
namespace WimyGit
{
    public interface IGitRepository
    {
        public string GetRepositoryPath();
        public GitWrapper GetGitWrapper();
        public System.Threading.Tasks.Task<bool> Refresh();
    }
}
