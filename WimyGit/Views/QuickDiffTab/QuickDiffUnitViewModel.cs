using System.Drawing;
using System.Windows.Controls;
using System.Windows.Documents;
using WimyGit.Service;

namespace WimyGit.Views.QuickDiffTab
{
    internal class QuickDiffUnitViewModel : NotifyBase
    {
        public string Title { get; set; } = "No title";

        private RichTextBox _richTextBox;

        public QuickDiffUnitViewModel(RichTextBox richTextBox)
        {
            _richTextBox = richTextBox;
        }

        public void SetContentBuilder(QuickDiffContentInfo quickDiffContentInfo)
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
                flowDocument.Blocks.Add(ConvertToParagraph(line));
            }
        }

        private Paragraph ConvertToParagraph(string line)
        {
            Paragraph paragraph = new Paragraph();
            foreach(var ansiToken in WimyGitLib.AnsiParser.Parse(line))
            {
                Run run = new Run(ansiToken.Text);
                run.Background = System.Windows.Media.Brushes.Black;
                if (ansiToken.Color == null)
                {
                    run.Foreground = System.Windows.Media.Brushes.White;
                }
                else
                {
                    Color color = ansiToken.Color.Value;
                    run.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(color.R, color.G, color.B));
                }
                paragraph.Inlines.Add(run);
            }
            return paragraph;
        }
    }
}
