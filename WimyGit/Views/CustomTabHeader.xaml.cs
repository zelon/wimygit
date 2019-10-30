using System.Windows.Controls;

namespace WimyGit.Views
{
    /// <summary>
    /// Interaction logic for CustomTabHeader.xaml
    /// </summary>
    public partial class CustomTabHeader : UserControl
    {
        public CustomTabHeader(string title)
        {
            InitializeComponent();

            Title.Content = title;
        }

        public void SetTitle(string title)
        {
            Title.Content = title;
        }
    }
}
