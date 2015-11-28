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
            if (selectedModifiedFilePathList.Count() ==0)
            {
                return;
            }
            LibGit2Sharp.StageOptions option = new LibGit2Sharp.StageOptions();
            repository_.Stage(selectedModifiedFilePathList, option);
        }

        public void Diff(string filepath)
        {
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_, null);
            runner.RunWithoutWaiting("difftool " + path_ + "\\" + filepath);
        }

        public void DiffStaged(string filepath)
        {
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_, null);
            runner.RunWithoutWaiting("difftool --cached " + path_ + "\\" + filepath);
        }

        internal void Commit(string commitMessage)
        {
            var signature = repository_.Config.BuildSignature(DateTimeOffset.Now);
            var commitOption = new LibGit2Sharp.CommitOptions();
            commitOption.AllowEmptyCommit = false;
            commitOption.AmendPreviousCommit = false;
            repository_.Commit(commitMessage, signature, signature, commitOption);
        }

        internal void GetHistory()
        {
            LibGit2Sharp.IQueryableCommitLog commit_list = repository_.Commits;
            foreach (var log in commit_list)
            {
                Console.WriteLine(log.Message);
            }
        }

        internal string GetCurrentBranch()
        {
            return repository_.Head.Name;
        }

        internal string GetCurrentBranchTrackingRemote()
        {
            var head = repository_.Head;
            int? ahead_by = head.TrackingDetails.AheadBy;
            int? behind_by = head.TrackingDetails.BehindBy;

            if (ahead_by != null)
            {
                return "+" + ahead_by.ToString() + " ahead";
            }

            if (behind_by != null)
            {
                return "-" + behind_by.ToString() + " behind";
            }
            return "";
        }

        internal void P4Revert(string path)
        {
            LibGit2Sharp.CheckoutOptions option = new LibGit2Sharp.CheckoutOptions();
            option.CheckoutModifiers = LibGit2Sharp.CheckoutModifiers.Force;
            repository_.CheckoutPaths(repository_.Head.Tip.Sha, new[] { path }, option);
        }
    }
}
