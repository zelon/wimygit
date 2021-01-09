using WimyGitLib;
using Xunit;

namespace xUnitTest
{
    public class TestRemoteParser
    {
        [Fact]
        public void TestRemoteParser1()
        {
            string line = "origin  https://github.com/zelon/wimygit.git (fetch)";
            var remoteInfo = RemoteParser.ParseLine(line);
            Assert.Equal("origin", remoteInfo.Name);
            Assert.Equal("https://github.com/zelon/wimygit.git", remoteInfo.Url);
            Assert.Equal("(fetch)", remoteInfo.Mirror);
        }
    }
}
