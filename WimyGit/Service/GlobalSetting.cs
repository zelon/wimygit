using System;
using System.Diagnostics;

namespace WimyGit
{
	public class GlobalSetting
	{
		public Config.Model ConfigModel { get; }
		private static readonly GlobalSetting instance_;
		private MainWindow window_;
		private static string signature_;

		static GlobalSetting()
		{
			instance_ = new GlobalSetting();
		}

		public static GlobalSetting GetInstance()
		{
			return instance_;
		}

		private GlobalSetting()
		{
			ConfigModel = Config.ConfigFileController.Load();
		}

		public void SetWindow(MainWindow window)
		{
            Debug.Assert(window != null, "Window should be initialized before use");
            window_ = window ?? throw new ArgumentNullException(nameof(window));
		}

		public MainWindow GetWindow()
		{
			Debug.Assert(window_ != null, "Window should be initialized before use");
			return window_;
		}

		public void ViewFile(string filename)
		{
			string editorPath = ConfigModel.ExternalEditor ?? "gvim.exe";
			Debug.Assert(!string.IsNullOrEmpty(editorPath), "Editor path must not be empty");
			
			string cmd = $"-d {filename}.untracked {filename}";
            WimyGitLib.RunExternal runner = new WimyGitLib.RunExternal(editorPath, ".");
			runner.RunWithoutWaiting(cmd);
		}

		public string GetSignature()
		{
			if (string.IsNullOrEmpty(signature_) == false)
			{
				return signature_;
			}
			signature_ = GitWrapper.GetSignature();
			Debug.Assert(!string.IsNullOrEmpty(signature_), "Git signature must not be empty");
			return signature_;
		}
	}
}
