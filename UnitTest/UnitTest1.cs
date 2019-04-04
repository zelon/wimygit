using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using WimyGit;

namespace UnitTest
{
    [TestClass]
    public class UnitTest1
    {
        [TestMethod]
        public void TestMethod1()
        {
            string line =
                " M WimyGit.sln";
            GitFileStatus gitFileStatus = GitPorcelainParser.ParseFileStatus(line);
            Assert.AreEqual("WimyGit.sln", gitFileStatus.Modified.Filename);
        }
    }
}
