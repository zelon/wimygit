using System;
using System.Diagnostics;
using WimyGit.UI.QuestionWindow;

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

        public void StartConsoleProgressWindow(string repositoryPath, string gitCommand)
        {
            var console_progress_window = new ConsoleProgressWindow(repositoryPath, ProgramPathFinder.GetGitBin(), gitCommand);
            console_progress_window.Owner = GlobalSetting.GetInstance().GetWindow();
            console_progress_window.ShowDialog();
        }

        public void StartConsoleProgressWindow(WeakReference<IGitRepository> gitRepositoryWeakReference, string gitCommand)
        {
            if (gitRepositoryWeakReference.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                Debug.Assert(false);
                return;
            }
            var console_progress_window = new ConsoleProgressWindow(gitRepository.GetRepositoryPath(), ProgramPathFinder.GetGitBin(), gitCommand);
            console_progress_window.Owner = GlobalSetting.GetInstance().GetWindow();
            console_progress_window.ShowDialog();
        }
    }
}
