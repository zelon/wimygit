using System.Windows;

namespace WimyGit
{
    public static class MessageBox
    {
        private static string kCaption = "WimyGit";

        public static void ShowMessage(string message)
        {
            var window = GlobalSetting.GetInstance().GetWindow();
            System.Windows.MessageBox.Show(window, message, kCaption);
        }

        public static System.Windows.MessageBoxResult ShowMessageWithYesNo(string message)
        {
            var window = GlobalSetting.GetInstance().GetWindow();
            return System.Windows.MessageBox.Show(window, message, kCaption,
                MessageBoxButton.YesNo, MessageBoxImage.Question);
        }
    }
}
