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
        private ILogger logger_;

        public GitWrapper(string path, ILogger logger)
        {
            path_ = path;
            logger_ = logger;
            repository_ = new LibGit2Sharp.Repository(path_);
        }

        public List<string> GetGitStatusPorcelainAll()
        {
            string cmd = string.Format("status --porcelain");
            return CreateGitRunner().Run(cmd);
        }

        public void DiffHistorySelected(string commit_id, string fileName)
        {
            string cmd = String.Format("difftool --no-prompt {0}^! -- {1}", commit_id, Util.WrapFilePath(fileName));
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void ViewTimeLapse(string selectedPath)
        {
            string cmd = String.Format("gui blame {0}", Util.WrapFilePath(selectedPath));
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public List<FileListInfoOfCommit> GetFilelistOfCommit(string sha)
        {
            // https://answers.atlassian.com/questions/303235/how-to-get-the-list-of-files-from-a-merge-commit-id
            string cmd = string.Format("diff --name-status {0}^ {0}", sha);
            logger_.AddLog(cmd);
            var raw_outputs = CreateGitRunner().Run(cmd);
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

        public void Stage(IEnumerable<string> selectedModifiedFilePathList)
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
                string cmd = "reset HEAD " + Util.WrapFilePath(file);
                logger_.AddLog(cmd);
                runner.Run(cmd);
            }
        }

        public void DiffTool(string filepath)
        {
            string cmd = "difftool --no-prompt -- " + Util.WrapFilePath(path_ + "\\" + filepath);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void DiffToolStaged(string filepath)
        {
            string cmd = "difftool --cached --no-prompt " + Util.WrapFilePath(path_ + "\\" + filepath);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public string GetSignature()
        {
            List<string> outputs = CreateGitRunner().Run("config --list");
            string name_prefix = "user.name=";
            string name = "unknown";
            string email_prefix = "user.email=";
            string email = "unknown@unknown.unknown";
            foreach (string output in outputs)
            {
                if (output.StartsWith(name_prefix))
                {
                    name = output.Substring(name_prefix.Length);
                }
                if (output.StartsWith(email_prefix))
                {
                    email = output.Substring(email_prefix.Length);
                }
            }
            return String.Format("{0} <{1}>", name, email);
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
            logger_.AddLog(cmd);
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
            logger_.AddLog(cmd);
            CreateGitRunner().Run(cmd);
        }

        private RunExternal CreateGitRunner()
        {
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
            return runner;
        }
    }
}
