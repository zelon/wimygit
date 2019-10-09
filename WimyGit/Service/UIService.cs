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
    }
}
