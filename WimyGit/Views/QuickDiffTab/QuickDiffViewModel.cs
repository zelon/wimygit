using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Controls;
using System.Windows.Documents;

namespace WimyGit.ViewModels
{
    public class QuickDiffViewModel : NotifyBase
    {
        public bool NeedToDiff { get; set; } = false;
        private string output_ = "no diff file selected";
        public string Output
        {
            get { return output_; }
            set {
                output_ = value;
                NotifyPropertyChanged("Output");
            }
        }

        private RichTextBox _richTextBox;

        public QuickDiffViewModel(/*RichTextBox richTextBox*/)
        {
            //_richTextBox = richTextBox;
        }

        public void SetRichText(List<string> texts)
        {
            FlowDocument flowDocument = new FlowDocument();
            Paragraph paragraph = new Paragraph();
            foreach (string line in texts)
            {
                paragraph.Inlines.Add(line);
            }
            flowDocument.Blocks.Clear();
            flowDocument.Blocks.Add(paragraph);
            _richTextBox.Document = flowDocument;
        }
    }
}
