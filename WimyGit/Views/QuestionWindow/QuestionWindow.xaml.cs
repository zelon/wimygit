using System.Windows;

namespace WimyGit.UI.QuestionWindow
{
    public partial class QuestionWindow : Window
    {
        public MessageBoxResult Result { get; set; }

        public QuestionWindow()
        {
            InitializeComponent();

            Answer.Focus();

            Result = MessageBoxResult.Cancel;
        }

        private void OnOK(object sender, RoutedEventArgs e)
        {
            Result = MessageBoxResult.OK;
            Close();
        }

        private void OnCancel(object sender, RoutedEventArgs e)
        {
            Result = MessageBoxResult.Cancel;
            Close();
        }
    }
}
