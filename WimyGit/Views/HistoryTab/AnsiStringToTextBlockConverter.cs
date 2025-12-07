using System;
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;

namespace WimyGit
{
    public class AnsiStringToTextBlockConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            string text = value as string;
            if (string.IsNullOrEmpty(text))
            {
                return new TextBlock();
            }
            var textBlock = new TextBlock();
            var ansiTokens = WimyGitLib.AnsiParser.Parse(text);
            Util.AppendAnsiToTextBlockWithToneDown(ansiTokens, textBlock);
            return textBlock;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
