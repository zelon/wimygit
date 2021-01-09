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
    }
}
