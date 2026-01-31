using System.Collections.Generic;
using System.Linq;

namespace WimyGit.Service
{
    public class QuickDiffContentInfo
    {
        public bool IsDiffColorView { get; set; }
        public string Display { get; set; }
        public List<string> Lines { get; set; } = [];
    }

    public class QuickDiffBuilder
    {
        private IGitRepository GitRepository { get; set; }
        private string FilePath { get; }
        private string CurrentCommitId { get; }
        private string DisplayPrefix { get; set; }
        private string NewFilePath { get; set; }
        private string DiffCommand { get; set; }
        private List<string> RawBody { get; set; } = [];
        public bool IsDiffColorView { get; set; } = true;

        public QuickDiffBuilder(IGitRepository gitRepository, string filePath, string currentCommitId, string displayPrefix, string newFilePath, string diffCommand,
            List<string> rawBody = null)
        {
            CurrentCommitId = currentCommitId;
            GitRepository = gitRepository;
            FilePath = filePath;
            DisplayPrefix = displayPrefix;
            NewFilePath = newFilePath;
            if (diffCommand.StartsWith("diff "))
            {
                diffCommand = "diff --color=always" + diffCommand.Substring(4);
            }
            DiffCommand = diffCommand;
            RawBody = rawBody;
        }

        public List<QuickDiffContentInfo> Build()
        {
            List<QuickDiffContentInfo> output = [];
            if (string.IsNullOrEmpty(NewFilePath) == false)
            {
                List<string> lines = System.IO.File.ReadAllLines(NewFilePath).ToList();
                output.Add(new QuickDiffContentInfo()
                {
                    IsDiffColorView = false,
                    Display = DisplayPrefix,
                    Lines = lines
                });
                return output;
            }
            if (string.IsNullOrEmpty(DiffCommand) == false)
            {
                WimyGitLib.RunExternal runner = GitRepository.CreateGitRunner();
                GitRepository.AddLog(DiffCommand);
                List<string> lines = runner.Run(DiffCommand);
                output.Add(new QuickDiffContentInfo()
                {
                    IsDiffColorView = IsDiffColorView,
                    Display = DisplayPrefix + "[DIFF]",
                    Lines = lines
                });
                if (string.IsNullOrEmpty(CurrentCommitId) == false)
                {
                    List<string> parentCommitIds = WimyGitLib.GetParentCommitIds.Get(runner, CurrentCommitId);
                    if (parentCommitIds.Count > 1)
                    {
                        foreach (string parentCommitId in parentCommitIds)
                        {
                            string subDiffCommand = $"diff --color=always {parentCommitId} {CurrentCommitId} -- \"{FilePath}\" ";
                            GitRepository.AddLog(subDiffCommand);
                            List<string> subDiffLines = runner.Run(subDiffCommand);
                            output.Add(new QuickDiffContentInfo()
                            {
                                IsDiffColorView = IsDiffColorView,
                                Display = $"{DisplayPrefix}[DIFF vs {parentCommitId}]",
                                Lines = subDiffLines
                            });
                        }
                    }
                }
                return output;
            }
            if (RawBody != null)
            {
                output.Add(new QuickDiffContentInfo()
                {
                    IsDiffColorView = true,
                    Display = DisplayPrefix,
                    Lines = RawBody
                });
                return output;
            }
            output.Add(new QuickDiffContentInfo()
            {
                IsDiffColorView = true,
                Display = DisplayPrefix,
                Lines = new List<string>()
            });
            return output;
        }
    }
}
