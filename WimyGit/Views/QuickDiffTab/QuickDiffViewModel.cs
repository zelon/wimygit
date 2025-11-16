using System.Collections.Generic;
using System.Windows.Controls;
using System.Windows.Documents;
using WimyGit.Service;

namespace WimyGit.ViewModels
{
    public class QuickDiffViewModel : NotifyBase
    {
        public string Title { get; set; } = "No title";

        private RichTextBox _richTextBox;

        public QuickDiffViewModel(RichTextBox richTextBox)
        {
            _richTextBox = richTextBox;
        }

        public void SetRichText(QuickDiffContentInfo quickDiffContentInfo)
        {
            Title = quickDiffContentInfo.Display;
            if (quickDiffContentInfo.IsDiffColorView == false)
            {
                Title += "[UNTRACKED]";
            }
            NotifyPropertyChanged("Title");

            var flowDocument = _richTextBox.Document;
            flowDocument.Blocks.Clear();
            foreach (string line in quickDiffContentInfo.Lines)
            {
                flowDocument.Blocks.Add(ConvertToParagraph(quickDiffContentInfo.IsDiffColorView, line));
            }
        }

        private Paragraph ConvertToParagraph(bool isDiffColorView, string line)
        {
            var removeBrush = System.Windows.Media.Brushes.Red;
            var addBrush = System.Windows.Media.Brushes.LightGreen;

            Paragraph paragraph = new Paragraph();
            Run run = new Run(line);
            run.Background = System.Windows.Media.Brushes.Black;

            if (isDiffColorView == false)
            {
                run.Foreground = System.Windows.Media.Brushes.White;
                paragraph.Inlines.Add(run);
                return paragraph;
            }

            if (line.StartsWith("@@ "))
            {
                var reg = new System.Text.RegularExpressions.Regex("@@( .* )@@(.*)");
                var match = reg.Match(line);
                if (match.Success)
                {
                    var range = match.Groups[1].Value;
                    var remaining = match.Groups[2].Value;

                    paragraph.Inlines.Add(new Run($"@@{range}@@") { Foreground = System.Windows.Media.Brushes.SkyBlue });
                    paragraph.Inlines.Add(new Run(remaining));

                    run.Foreground = System.Windows.Media.Brushes.White;
                }
                else
                {
                    paragraph.Inlines.Add(run);
                }
            }
            else
            {
                if (line.StartsWith("diff") || line.StartsWith("index"))
                {
                    run.Foreground = System.Windows.Media.Brushes.White;
                }
                else if (line.StartsWith("---") || line.StartsWith("+++"))
                {
                    run.Foreground = System.Windows.Media.Brushes.White;
                }
                else if (line.StartsWith('+'))
                {
                    run.Foreground = addBrush;
                }
                else if (line.StartsWith('-'))
                {
                    run.Foreground = removeBrush;
                }
                paragraph.Inlines.Add(run);
            }
            return paragraph;
        }
    }
}
