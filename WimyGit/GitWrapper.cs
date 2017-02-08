using System;
using System.Collections.Generic;
using System.Linq;

namespace WimyGit
{
    class CommitInfo
    {
        public string Graph { get; set; }
        public string Sha { get; set; }
        public string Author { get; set; }
        public string LocalTimeDate { get; set; }
        public string Message { get; set; }
        public string RefNames { get; set; }
    }

    class FileListInfoOfCommit
    {
        public string Status { get; set; }
        public string FileName { get; set; }
    }

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

        public void DiffHistorySelected(string commit_id, string fileName)
        {
            string cmd = String.Format("difftool --no-prompt {0}^! {1}", commit_id, Util.WrapFilePath(fileName));
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void ViewTimeLapse(string selectedPath)
        {
            string cmd = String.Format("gui blame {0}", Util.WrapFilePath(selectedPath));
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public List<FileListInfoOfCommit> GetFilelistOfCommit(string sha)
        {
            var raw_outputs = CreateGitRunner().Run("diff-tree --no-commit-id --name-status -r " + sha);
            var output = new List<FileListInfoOfCommit>();
            foreach (string line in raw_outputs)
            {
                var splitted = line.Split('\t');
                System.Diagnostics.Debug.Assert(splitted.Length == 2);
                var converted = new FileListInfoOfCommit();
                converted.Status = splitted[0];
                converted.FileName = splitted[1];
                output.Add(converted);
            }
            return output;
        }

        internal void Stage(IEnumerable<string> selectedModifiedFilePathList)
        {
            if (selectedModifiedFilePathList.Count() == 0)
            {
                return;
            }
            LibGit2Sharp.StageOptions option = new LibGit2Sharp.StageOptions();
            repository_.Stage(selectedModifiedFilePathList, option);
        }

        public void Unstage(IEnumerable<string> filelist)
        {
            if (filelist.Count() == 0)
            {
                return;
            }
            var runner = CreateGitRunner();
            foreach (var file in filelist)
            {
                runner.Run("reset HEAD " + Util.WrapFilePath(file));
            }
        }

        public void Diff(string filepath)
        {
            CreateGitRunner().RunWithoutWaiting("difftool --no-prompt " + Util.WrapFilePath(path_ + "\\" + filepath));
        }

        public void DiffStaged(string filepath)
        {
            CreateGitRunner().RunWithoutWaiting("difftool --cached --no-prompt " + Util.WrapFilePath(path_ + "\\" + filepath));
        }

        public LibGit2Sharp.Signature GetCurrentSignature()
        {
            return repository_.Config.BuildSignature(DateTimeOffset.Now);
        }

        internal void Commit(string commitMessage)
        {
            var signature = repository_.Config.BuildSignature(DateTimeOffset.Now);
            var commitOption = new LibGit2Sharp.CommitOptions();
            commitOption.AllowEmptyCommit = false;
            commitOption.AmendPreviousCommit = false;
            repository_.Commit(commitMessage, signature, signature, commitOption);
        }

        private List<CommitInfo> Parse(List<string> lines)
        {
            List<CommitInfo> output = new List<CommitInfo>();
            foreach (string line in lines)
            {
                string[] splited = line.Split('`');

                CommitInfo info = new CommitInfo();
                info.Graph = splited[0];

                if (splited.Length > 5)
                {
                    info.LocalTimeDate = splited[1];
                    info.Sha = splited[2];
                    info.Author = splited[3];
                    info.RefNames = splited[4];
                    info.Message = splited[5];
                }
                output.Add(info);
            }
            return output;
        }

        public List<CommitInfo> GetHistory(string selected_path, Int32 skip_count, Int32 max_count)
        {
            string cmd = string.Format("log --all --encoding=UTF-8 --skip={0} --max-count={1} --graph --format=\"`%ai`%H`%an`%d`%s\" -- {2}", skip_count, max_count, selected_path);
            return Parse(CreateGitRunner().Run(cmd));
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

        public void P4Revert(string filename)
        {
            string cmd = string.Format("checkout -- {0}", Util.WrapFilePath(filename));
            CreateGitRunner().Run(cmd);
        }

        private RunExternal CreateGitRunner()
        {
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
            return runner;
        }
    }
}
