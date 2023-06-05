using WimyGitLib;
using Xunit;

namespace xUnitTest
{
    public class TestBranchParser
    {
        [Fact]
        public void TestBranchParser1()
        {
            string line = "* feature/test  659460d fff";
            var branchInfo = BranchParser.ParseLine(line);
            Assert.True(branchInfo.IsCurrent);
            Assert.Equal("feature/test", branchInfo.Name);
            Assert.Equal("659460d", branchInfo.CommitId);
        }

        [Fact]
        public void TestBranchParser2()
        {
            string line = "  feature/test  659460d fff";
            var branchInfo = BranchParser.ParseLine(line);
            Assert.False(branchInfo.IsCurrent);
            Assert.Equal("feature/test", branchInfo.Name);
            Assert.Equal("659460d", branchInfo.CommitId);
        }

        [Fact]
        public void TestBranchParser3()
        {
            string line = "  k5            5fee120 fff";
            var branchInfo = BranchParser.ParseLine(line);
            Assert.False(branchInfo.IsCurrent);
            Assert.Equal("k5", branchInfo.Name);
            Assert.Equal("5fee120", branchInfo.CommitId);
        }

        [Fact]
        public void TestBranchParser4()
        {
            string line = "  master 2af6d5b [origin/master: ahead 2] Add a link menu to WimyGit Release page";
            var branchInfo = BranchParser.ParseLine(line);
            Assert.False(branchInfo.IsCurrent);
            Assert.Equal("master", branchInfo.Name);
            Assert.Equal("2af6d5b", branchInfo.CommitId);
            Assert.Equal("[origin/master: ahead 2] Add a link menu to WimyGit Release page", branchInfo.AdditionalInfo);
        }
    }
}
