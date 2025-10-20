using System.Collections.Generic;
using System.Linq;

namespace WimyGit.Service
{
    public class QuickDiffBuilder
    {
        private IGitRepository GitRepository { get; set; }
        private string DisplayPrefix { get; set; }
        private string NewFilePath { get; set; }
        private string DiffCommand { get; set; }
        private List<string> RawBody { get; set; } = [];

        public QuickDiffBuilder(IGitRepository gitRepository, string displayPrefix, string newFilePath, string diffCommand,
            List<string> rawBody = null)
        {
            GitRepository = gitRepository;
            DisplayPrefix = displayPrefix;
            NewFilePath = newFilePath;
            DiffCommand = diffCommand;
            RawBody = rawBody;
        }

        public (string displayPrefix, List<string> lines) Build()
        {
            if (string.IsNullOrEmpty(NewFilePath) == false)
            {
                List<string> lines = System.IO.File.ReadAllLines(NewFilePath).ToList();
                return (DisplayPrefix + "[NEW FILE]", lines);
            }
            if (string.IsNullOrEmpty(DiffCommand) == false)
            {
                RunExternal runner = GitRepository.CreateGitRunner();
                GitRepository.AddLog(DiffCommand);
                List<string> lines = runner.Run(DiffCommand);
                return (DisplayPrefix + "[DIFF]", lines);
            }
            if (RawBody != null)
            {
                return (DisplayPrefix, RawBody);
            }
            return (DisplayPrefix, new List<string>());
        }
    }
}
