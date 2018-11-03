using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        public string FileName2 { get; set; }
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
            string cmd = string.Format("status --porcelain --untracked-files=all");
            return CreateGitRunner().Run(cmd);
        }

        public async Task<List<string>> GetGitStatusPorcelainAllAsync()
        {
            string cmd = string.Format("status --porcelain --untracked-files=all");
            return await CreateGitRunner().RunAsync(cmd);
        }

        public void DiffHistorySelected(string commit_id, string fileName)
        {
            string cmd = String.Format("difftool --no-prompt {0}^! -- {1}", commit_id, Util.WrapFilePath(fileName));
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void DiffHistorySelectedWithRenameTracking(string commit_id, string fileName, string fileName2)
        {
            string cmd = String.Format("difftool --no-prompt {0}^! -M -- {1} {2}", commit_id, Util.WrapFilePath(fileName), Util.WrapFilePath(fileName2));
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
                var converted = new FileListInfoOfCommit();
                var splitted = line.Split('\t');
                if (splitted.Length == 2)
                {
                    converted.Status = splitted[0];
                    converted.FileName = splitted[1];
                }
                else if (splitted.Length == 3 && splitted[0].StartsWith("R"))
                {
                    converted.Status = "Rename";
                    converted.FileName = splitted[1];
                    converted.FileName2 = splitted[2];
                }
                else
                {
                    System.Diagnostics.Debug.Assert(false, "Cannot parse diff output correctly");
                }
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

			string cmd = "add ";
			foreach (string filename in selectedModifiedFilePathList)
			{
				cmd += string.Format(" {0}", Util.WrapFilePath(filename));
			}
			logger_.AddLog(cmd);
			CreateGitRunner().Run(cmd);
		}

		public void StagePartial(string filepath)
        {
            Debug.Assert(string.IsNullOrEmpty(filepath) == false);

            string cmd = "add --patch " + Util.WrapFilePath(filepath);
            logger_.AddLog(cmd);
            CreateGitRunner().RunGitCmdInConsoleAndContinue(cmd);
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

        public void Commit(string commit_message)
        {
            // Use temp file to commit with multiline message
            string temp_filename;
            try
            {
                temp_filename = Path.GetTempFileName();
            } catch (IOException)
            {
                Service.GetInstance().ShowMsg("Cannot create temp file for commit");
                return;
            }
            using (var stream = File.CreateText(temp_filename))
            {
                stream.Write(commit_message);
            }
            string cmd = "commit --file=\"" + temp_filename + "\"";
            CreateGitRunner().Run(cmd);

            File.Delete(temp_filename);
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

        public async Task<List<CommitInfo>> GetHistory(string selected_path, Int32 skip_count, Int32 max_count)
        {
            string cmd = string.Format("log --all --encoding=UTF-8 --skip={0} --max-count={1} --graph --format=\"`%ai`%H`%an`%d`%s\" -- {2}", skip_count, max_count, selected_path);
            logger_.AddLog(cmd);
            List<string> result = await CreateGitRunner().RunAsync(cmd);
            return Parse(result);
        }

        public string GetCurrentBranchName()
        {
            string cmd = "branch";
            List<string> results = CreateGitRunner().Run(cmd);
            if (results.Count == 0)
            {
                return "[No branch yet]";
            }
            foreach (string line in results)
            {
                if (line.StartsWith("*"))
                {
                    return line.Substring(2);
                }
            }
            Debug.Assert(false, "Cannot get a valid branch name");
            return "Cannot get a valid branch name";
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
