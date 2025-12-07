using System.Collections.Generic;
using System.Drawing;
using WimyGitLib;
using Xunit;

namespace xUnitTest;

public class TestGitLogGraph
{
    [Fact]
    public void TestParseColor()
    {
        List<AnsiToken> ansiTokens = AnsiParser.Parse("abc\u001b[31m|\u001b[m Date1 ## \u001b[31m|\u001b[m Date2");

        Assert.Equal(5, ansiTokens.Count);
        Assert.Null(ansiTokens[0].Color);
        Assert.Equal("abc", ansiTokens[0].Text);

        Assert.Equal(Color.Red, ansiTokens[1].Color);
        Assert.Equal("|", ansiTokens[1].Text);

        Assert.Null(ansiTokens[2].Color);
        Assert.Equal(" Date1 ## ", ansiTokens[2].Text);

        Assert.Equal(Color.Red, ansiTokens[3].Color);
        Assert.Equal("|", ansiTokens[3].Text);

        Assert.Null(ansiTokens[4].Color);
        Assert.Equal(" Date2", ansiTokens[4].Text);
    }

    [Fact]
    public void TestParseColorWithFontWeight()
    {
        List<AnsiToken> ansiTokens = AnsiParser.Parse("abc\u001b[1;31mdef");
        Assert.Equal(2, ansiTokens.Count);
        Assert.Equal("abc", ansiTokens[0].Text);
        Assert.Equal("def", ansiTokens[1].Text);
    }
}
