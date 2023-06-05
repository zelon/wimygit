using Xunit;
using WimyGitLib;

namespace xUnitTest
{
    public class UnitTest1
    {
        [Fact]
        public void Test1()
        {
            string line = " M WimyGit.sln";
            GitFileStatus gitFileStatus = GitPorcelainParser.ParseFileStatus(line);
            Assert.Equal("WimyGit.sln", gitFileStatus.Modified.Filename);
        }

        [Fact]
        public void TestGetVersionFromDownloadUrl()
        {
            var result = DownloadParser.GetVersionFromDownloadUrl("https://github.com/zelon/wimygit/releases/download/v1.0.0/WimyGit-1.0.0.zip");
            var version = result.Version;

            Assert.Equal(1, version.Major);
            Assert.Equal(0, version.Minor);
            Assert.Equal(0, version.Build);

            Assert.Equal("WimyGit-1.0.0.zip", result.DownloadFilename);
        }
    }
}
