using System.Collections.Generic;
using System.Drawing;
using System.Text.RegularExpressions;

namespace WimyGitLib
{
    // 하나의 행은 여러개의 Cell 을 가진다
    public class AnsiParser
    {
        public static Regex ansiTokenRegex = new Regex(@"\u001b\[([0-2;]*?\d*?)m");

        public static List<AnsiToken> Parse(string input)
        {
            var output = new List<AnsiToken>();

            if (string.IsNullOrEmpty(input))
            {
                return output;
            }
            Color? lastColorCode = null;
            while (true)
            {
                Match match = ansiTokenRegex.Match(input);
                if (match.Success == false)
                {
                    break;
                }
                string newColorCode = match.Groups[1].Value;
                // 찾은 것 앞까지 잘라내서 지난번의 text
                string lastText = input.Substring(0, match.Index);
                if (string.IsNullOrEmpty(lastText) == false)
                {
                    output.Add(new AnsiToken()
                    {
                        Text = lastText,
                        Color = lastColorCode
                    });
                }
                lastColorCode = ConvertAnsiToColor(newColorCode);
                input = input.Substring(match.Index + match.Length);
            }
            // 마지막 남은 텍스트가 있으면
            if (string.IsNullOrEmpty(input) == false)
            {
                output.Add(new AnsiToken()
                {
                    Text = input
                });
            }
            return output;
        }

        public static Color? ConvertAnsiToColor(string code)
        {
            if (code.Contains(";"))
            {
                code = code.Substring(2);
            }
            return code switch
            {
                "30" => Color.Black,
                "31" => Color.Red,
                "32" => Color.Green,
                "33" => Color.Yellow,
                "34" => Color.Blue,
                "35" => Color.Magenta,
                "36" => Color.Cyan,
                "37" => Color.White,

                "90" => Color.DarkGray,
                "91" => Color.IndianRed,
                "92" => Color.LightGreen,
                "93" => Color.LightYellow,
                "94" => Color.LightBlue,
                "95" => Color.Plum,
                "96" => Color.LightCyan,
                "97" => Color.White,

                "0" => null, // reset
                _ => null
            };
        }
    }
}
