using System.Windows;
using WimyGit.UI.QuestionWindow;

namespace WimyGit
{
    public static class UIService
    {
        private const string Caption = "WimyGit";

        public static void ShowMessage(string message)
        {
            MainWindow window = GlobalSetting.GetInstance().GetWindow();
            MessageBox.Show(window, message, Caption);
        }

        public static MessageBoxResult ConfirmMsg(string msg, string caption)
        {
            return MessageBox.Show(msg, caption, MessageBoxButton.OKCancel);
        }

        public static MessageBoxResult ShowMessageWithYesNo(string message)
        {
            MainWindow window = GlobalSetting.GetInstance().GetWindow();
            return MessageBox.Show(window, message, Caption, MessageBoxButton.YesNo, MessageBoxImage.Question);
        }

        public static MessageBoxResult ShowMessageWithOKCancel(string message)
        {
            MainWindow window = GlobalSetting.GetInstance().GetWindow();
            return MessageBox.Show(window, message, Caption, MessageBoxButton.OKCancel, MessageBoxImage.Question);
        }

        public static string AskAndGetString(string questionMessage, string defaultAnswer)
        {
            QuestionWindow questionWindow = new QuestionWindow();
            questionWindow.Owner = GlobalSetting.GetInstance().GetWindow();
            questionWindow.Question.Content = questionMessage;
            questionWindow.Answer.Text = defaultAnswer ?? "";
            questionWindow.ShowDialog();
            
            if (questionWindow.Result == MessageBoxResult.OK)
            {
                return questionWindow.Answer.Text;
            }
            return null;
        }

        // return true if selected yes and initialized git
        public static bool AskAndGitInit(string directory)
        {
            string message = $"Invalid git root directory:{directory}\n\n";
            message += $"Initialize as GIT repository?\n\n";
            message += $"This will execute 'git init' and create {directory}\\.git directory";
            if (ShowMessageWithYesNo(message) != MessageBoxResult.Yes)
            {
                return false;
            }
            GitWrapper gitWrapper = new GitWrapper(directory, null);
            gitWrapper.Init();

            return true;
        }
    }
}
