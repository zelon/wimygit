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
        private string DisplayPrefix { get; set; }
        private string NewFilePath { get; set; }
        private string DiffCommand { get; set; }
        private List<string> RawBody { get; set; } = [];
        public bool IsDiffColorView { get; set; } = true;

        public QuickDiffBuilder(IGitRepository gitRepository, string displayPrefix, string newFilePath, string diffCommand,
            List<string> rawBody = null)
        {
            GitRepository = gitRepository;
            DisplayPrefix = displayPrefix;
            NewFilePath = newFilePath;
            DiffCommand = diffCommand;
            RawBody = rawBody;
        }

        public QuickDiffContentInfo Build()
        {
            if (string.IsNullOrEmpty(NewFilePath) == false)
            {
                List<string> lines = System.IO.File.ReadAllLines(NewFilePath).ToList();
                return new QuickDiffContentInfo()
                {
                    IsDiffColorView = false,
                    Display = DisplayPrefix,
                    Lines = lines
                };
            }
            if (string.IsNullOrEmpty(DiffCommand) == false)
            {
                WimyGitLib.RunExternal runner = GitRepository.CreateGitRunner();
                GitRepository.AddLog(DiffCommand);
                List<string> lines = runner.Run(DiffCommand);
                return new QuickDiffContentInfo()
                {
                    IsDiffColorView = IsDiffColorView,
                    Display = DisplayPrefix + "[DIFF]",
                    Lines = lines
                };
            }
            if (RawBody != null)
            {
                return new QuickDiffContentInfo()
                {
                    IsDiffColorView = true,
                    Display = DisplayPrefix,
                    Lines = RawBody
                };
            }
            return new QuickDiffContentInfo()
            {
                IsDiffColorView = true,
                Display = DisplayPrefix,
                Lines = new List<string>()
            };
        }
    }
}
