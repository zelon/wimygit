using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace WimyGit
{
	public class CommitInfo
	{
		public string Graph { get; set; }
		public string Sha { get; set; }
		public string Author { get; set; }
		public string LocalTimeDate { get; set; }
		public string Message { get; set; }
		public string RefNames { get; set; }
	}

	public class FileListInfoOfCommit
	{
		public string Status { get; set; }
		public string FileName { get; set; }
		public string FileName2 { get; set; }
	}

    public class GitRepositoryStatus
    {
        public BranchInfo branchInfo { get; set; }
        public bool IsOnBisecting { get; set; }
    }

    public class BranchInfo
    {
        public string CurrentBranchName { get; set; }
        public string BranchTrackingRemoteStatus { get; set; }
        public bool NoCommitsYet { get; set; }
    }

    public class GitWrapper
	{
		private string path_;
		private ILogger logger_;

		public GitWrapper(string path, ILogger logger)
		{
			path_ = path;
			logger_ = logger;
		}

        public string GetPath()
        {
            return path_;
        }

        public void Init()
        {
            string cmd = string.Format("init");
            CreateGitRunner().Run(cmd);
        }

        public bool IsValidGitDirectory()
		{
			string cmd = string.Format("status --porcelain");
			List<string> results = CreateGitRunner().Run(cmd);
			foreach (string line in results)
			{
				if (line.StartsWith("fatal: not a git repository"))
				{
					return false;
				}
			}
			return true;
		}

        public async Task<List<StashedFileInfo>> GetStashedFileInfosAsync(string stashName)
        {
            List<StashedFileInfo> outputs = new List<StashedFileInfo>();
            {
                string cmd = GitCommandCreator.StashModifiedFileList(stashName);
                List<string> lines = await CreateGitRunner().RunAsync(cmd);
                foreach (string line in lines)
                {
                    var splitted = line.Split("\t");
                    Debug.Assert(splitted.Length >= 2);
                    StashedFileInfo stashedFileInfo = new StashedFileInfo();
                    stashedFileInfo.FileType = StashedFileInfo.StashedFileType.kModified;
                    stashedFileInfo.Status = splitted[0];
                    stashedFileInfo.Filename = splitted[1];

                    outputs.Add(stashedFileInfo);
                }
            }
            {
                string cmd = GitCommandCreator.StashUntrackedFileListWithCommitId(stashName);
                List<string> lines = await CreateGitRunner().RunAsync(cmd);
                lines.RemoveAt(0); // skip commit id
                foreach (string line in lines)
                {
                    var splitted = line.Split("\t");
                    Debug.Assert(splitted.Length >= 2);
                    StashedFileInfo stashedFileInfo = new StashedFileInfo();
                    stashedFileInfo.FileType = StashedFileInfo.StashedFileType.kUntracked;
                    stashedFileInfo.Status = splitted[0];
                    stashedFileInfo.Filename = splitted[1];

                    outputs.Add(stashedFileInfo);
                }
            }
            return outputs;
        }

        public List<StashedFileInfo> GetStashedFileInfos(string stashName)
        {
            var task = Task.Run(async () => await GetStashedFileInfosAsync(stashName));
            task.Wait();
            return task.Result;
        }

        public async Task<List<string>> GetGitStatusPorcelainAllAsync()
		{
			string cmd = string.Format("-c core.quotepath=false status --porcelain --untracked-files=all");
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

        public void CreateBranch(string commitId, string branchName)
        {
            string cmd = $"branch {branchName} {commitId}";
            CreateGitRunner().Run(cmd);
        }

        public void Rebase(string commitId)
        {
            string cmd = $"rebase {commitId}";
            CreateGitRunner().Run(cmd);
        }

        public void CreateTag(string commitId, string tagName)
        {
            string cmd = $"tag {tagName} {commitId}";
            CreateGitRunner().Run(cmd);
        }

        public List<FileListInfoOfCommit> GetFilelistOfCommit(string sha)
		{
            // https://answers.atlassian.com/questions/303235/how-to-get-the-list-of-files-from-a-merge-commit-id
            string cmd;
            List<string> raw_outputs;
            
            cmd = string.Format("-c core.quotepath=false diff --name-status {0}^ {0}", sha);
            logger_.AddLog(cmd);
            raw_outputs = CreateGitRunner().Run(cmd);
            if (raw_outputs.Count == 0 || raw_outputs[0].StartsWith("fatal"))
            {
                // if the sha indicate the first commit, cannot get diff from the previous
                cmd = string.Format("-c core.quotepath=false show --name-status --pretty=oneline {0}", sha);
                logger_.AddLog(cmd);
                raw_outputs = CreateGitRunner().Run(cmd);
                raw_outputs.RemoveAt(0); // skip commit id
            }
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

            List<string> filelists = new List<string>();
            string filelist = "";
			foreach (string filename in selectedModifiedFilePathList)
			{
				filelist += string.Format(" {0}", Util.WrapFilePath(filename));
                if (filelist.Length > 2048)
                {
                    filelists.Add(filelist);
                    filelist = "";
                }
			}
            if (string.IsNullOrEmpty(filelist) == false)
            {
                filelists.Add(filelist);
            }
            foreach (string result_filelist in filelists)
            {
                string cmd = "add " + result_filelist;
                logger_.AddLog(cmd);
                logger_.AddLog(CreateGitRunner().Run(cmd));
            }
        }

		public void StagePartial(string filepath)
		{
			Debug.Assert(string.IsNullOrEmpty(filepath) == false);

			string cmd = "add --patch " + Util.WrapFilePath(filepath);
			logger_.AddLog(cmd);
			CreateGitRunner().RunGitCmdInConsoleAndContinue(cmd);
		}

		public void Unstage(IEnumerable<string> filelist, bool isNoCommitsYet)
		{
			if (filelist.Count() == 0)
			{
				return;
			}
			var runner = CreateGitRunner();
			foreach (var file in filelist)
			{
                string cmd;
                if (isNoCommitsYet)
                {
                    cmd = "rm --cached " + Util.WrapFilePath(file);
                }
                else
                {
                    cmd = "reset HEAD " + Util.WrapFilePath(file);
                }
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

		static public string GetSignature()
		{
            RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), ".");
            List<string> outputs = runner.Run("config --list");
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
			return string.Format("{0} <{1}>", name, email);
		}

		public void Commit(string commit_message)
		{
			// Use temp file to commit with multiline message
			string temp_filename;
			try
			{
				temp_filename = Path.GetTempFileName();
			}
			catch (IOException)
			{
				MessageBox.ShowMessage("Cannot create temp file for commit");
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

        public void MergeTool(string filepath)
        {
            string cmd = "mergetool --no-prompt -- " + Util.WrapFilePath(path_ + "\\" + filepath);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public async Task<List<CommitInfo>> GetHistory(string selected_path, Int32 skip_count, Int32 max_count)
		{
            string checkPath = selected_path;
            if (checkPath == path_) // if checkPath == git repository root, empty path will show more detailed graphed history
            {
                checkPath = "";
            }
            if (string.IsNullOrEmpty(checkPath) == false)
            {
                checkPath = $"\"{checkPath}\"";
            }
			string cmd = string.Format("log --all --encoding=UTF-8 --skip={0} --max-count={1} --graph --format=\"`%ai`%H`%an`%d`%s\" -- {2}", skip_count, max_count, checkPath);
			logger_.AddLog(cmd);
			List<string> result = await CreateGitRunner().RunAsync(cmd);
			return Parse(result);
		}

		public GitRepositoryStatus GetRepositoryStatus()
		{
			string cmd = "status";
			List<string> results = CreateGitRunner().Run(cmd);
            GitRepositoryStatus gitRepositoryStatus = GitStatusParser.Parse(results);
            return gitRepositoryStatus;
		}

		public BranchInfo GetCurrentBranchInfo()
		{
			string cmd = "status";
			List<string> results = CreateGitRunner().Run(cmd);
            GitRepositoryStatus gitRepositoryStatus = GitStatusParser.Parse(results);
            return gitRepositoryStatus.branchInfo;
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

        public void StashDiffToolAgainstParentModified(string stashName, string fileName)
        {
            string cmd = GitCommandCreator.StashDiffToolAgainstParentModified(stashName, fileName);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void StashDiffToolAgainstParentUntracked(string stashName, string fileName)
        {
            string cmd = GitCommandCreator.StashDiffToolAgainstParentUntracked(stashName, fileName);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }

        public void StashDiffToolAgainstHEAD(string stashName, string fileName)
        {
            string cmd = GitCommandCreator.StashDiffToolAgainstHEAD(stashName, fileName);
            logger_.AddLog(cmd);
            CreateGitRunner().RunWithoutWaiting(cmd);
        }
    }
}
