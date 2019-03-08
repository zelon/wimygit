using System;

namespace WimyGit
{
	class GlobalSetting
	{
		public Config.Model ConfigModel { get; }
		private static GlobalSetting instance_ = null;
		private MainWindow window_ = null;
        static private string signature_;

        public static GlobalSetting GetInstance()
		{
			if (instance_ == null)
			{
				instance_ = new GlobalSetting();
			}
			return instance_;
		}

		private GlobalSetting()
		{
			ConfigModel = Config.ConfigFileController.Load();
		}

		public void SetWindow(MainWindow window)
		{
			window_ = window;
		}

		public void ShowMsg(string msg)
		{
			System.Windows.MessageBox.Show(window_, msg, "WimyGit");
		}

		public MainWindow GetWindow()
		{
			return window_;
		}

		public System.Windows.MessageBoxResult ConfirmMsg(string msg, string caption)
		{
			return System.Windows.MessageBox.Show(msg, caption, System.Windows.MessageBoxButton.OKCancel);
		}

		public void ViewFile(string filename)
		{
			string cmd = String.Format("-d {0}.untracked {0}", filename);
			RunExternal runner = new RunExternal("gvim.exe", ".");
			runner.RunWithoutWaiting(cmd);
		}

        public string GetSignature()
        {
            if (string.IsNullOrEmpty(signature_) == false)
            {
                return signature_;
            }
            signature_ = GitWrapper.GetSignature();
            return signature_;
        }
	}
}
