
namespace WimyGit
{
    public static class MessageBox
    {
        public static void ShowMessage(string message)
        {
            var window = GlobalSetting.GetInstance().GetWindow();
            System.Windows.MessageBox.Show(window, message, "WimyGit");
        }
    }
}
