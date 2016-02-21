using System;
using System.Collections.Generic;
using System.Linq;

namespace WimyGit
{
  class CommitInfo
  {
    public string Sha { get; set; }
    public string Author { get; set; }
    public string LocalTimeDate { get; set; }
    public string Message { get; set; }
    public string RefNames{ get; set; }
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

    public List<string> GetFilelistOfCommit(string sha)
    {
      RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
      return runner.Run("diff-tree --no-commit-id --name-only -r " + sha);
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

    public void Diff(string filepath)
    {
      RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
      runner.RunWithoutWaiting("difftool " + path_ + "\\" + filepath);
    }

    public void DiffStaged(string filepath)
    {
      RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
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

    private List<CommitInfo> Parse(List<string> lines)
    {
      List<CommitInfo> output = new List<CommitInfo>();
      foreach (string line in lines)
      {
        string[] splited = line.Split('|');

        CommitInfo info = new CommitInfo();
        info.LocalTimeDate = splited[1];
        info.Sha = splited[2];
        info.Author = splited[3];
        info.RefNames = splited[4];
        info.Message = splited[5];
        output.Add(info);
      }
      return output;
    }

    public List<CommitInfo> GetHistory(Int32 skip_count, Int32 max_count)
    {
      string cmd = string.Format("log --encoding=UTF-8 --skip={0} --max-count={1} --graph --format=\"|%ai|%H|%an|%d|%s\"", skip_count, max_count);
      RunExternal runner = new RunExternal(ProgramPathFinder.GetGitBin(), path_);
      return Parse(runner.Run(cmd));
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
