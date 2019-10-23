using System;
using System.Collections.Generic;
using WimyGit.UI.QuestionWindow;
using System.Text;

namespace WimyGit.Service
{
    class UIService
    {
        private static UIService instance_ = null;

        public static UIService GetInstance()
        {
            if (instance_ == null)
            {
                instance_ = new UIService();
            }
            return instance_;
        }

        private UIService()
        {

        }

        public string AskAndGetString(string questionMessage, string defaultAnswer)
        {
            QuestionWindow questionWindow = new QuestionWindow();
            questionWindow.Question.Content = questionMessage;
            questionWindow.Answer.Text = defaultAnswer ?? "";
            questionWindow.ShowDialog();
            
            if (questionWindow.Result == System.Windows.MessageBoxResult.OK)
            {
                return questionWindow.Answer.Text;
            }
            return null;
        }

        // return true if selected yes and initialized git
        public bool AskAndGitInit(string directory)
        {
            string message = $"Invalid git root directory:{directory}\n\n";
            message += $"Initialize as GIT repository?\n\n";
            message += $"This will execute 'git init' and create {directory}\\.git directory";
            var result = MessageBox.ShowMessageWithYesNo(message);
            if (result != System.Windows.MessageBoxResult.Yes)
            {
                return false;
            }
            GitWrapper gitWrapper = new GitWrapper(directory, null);
            gitWrapper.Init();

            return true;
        }
    }
}
