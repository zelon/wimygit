using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    // https://github.com/libgit2/libgit2sharp/wiki/LibGit2Sharp-Hitchhiker's-Guide-to-Git
    class GitWrapper
    {
        private string path_;
        private LibGit2Sharp.Repository repository_;

        public GitWrapper(string path)
        {
            path_ = path;
            repository_ = new LibGit2Sharp.Repository(path_);
        }

        public LibGit2Sharp.RepositoryStatus GetModifiedFileList()
        {
            LibGit2Sharp.StatusOptions option = new LibGit2Sharp.StatusOptions();
            return repository_.RetrieveStatus(option);
        }

        internal void Stage(IEnumerable<string> selectedModifiedFilePathList)
        {
            LibGit2Sharp.StageOptions option = new LibGit2Sharp.StageOptions();
            repository_.Stage(selectedModifiedFilePathList, option);
        }

        public void Diff(string filepath)
        {
            RunExternal runner = new RunExternal(@"C:\Program Files (x86)\Git\bin\git.exe", path_, null);
            runner.RunWithoutWaiting("difftool " + path_ + "\\" + filepath);
        }

        internal void Commit(string commitMessage)
        {
            //string name = repository_.Config.Get<string>("user.name");
            var signature = repository_.Config.BuildSignature(DateTimeOffset.Now);
            var commitOption = new LibGit2Sharp.CommitOptions();
            commitOption.AllowEmptyCommit = false;
            commitOption.AmendPreviousCommit = false;
            repository_.Commit(commitMessage, signature, signature, commitOption);
        }
    }
}
