﻿using System;

namespace WimyGit
{
	class Service
	{
		public Config.Model ConfigModel { get; }
		private static Service instance_ = null;
		private MainWindow window_ = null;

		public static Service GetInstance()
		{
			if (instance_ == null)
			{
				instance_ = new Service();
			}
			return instance_;
		}

		private Service()
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
	}
}
