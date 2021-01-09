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
    }
}
