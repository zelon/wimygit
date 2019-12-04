using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;

namespace WimyGit
{
	class StringArrayOutput
	{
		private List<string> result_ = new List<string>();

		public void OnOutput(string output)
		{
			if (output != null)
			{
				result_.Add(output);
			}
		}

		public List<string> GetResult()
		{
			return result_;
		}
	}

	public class RunExternal
	{
		private readonly string execute_filename_;
		private readonly string working_directory_;

		public RunExternal(string execute_filename, string working_directory)
		{
			execute_filename_ = execute_filename;
			working_directory_ = working_directory;
		}

		public void RunGitCmdInConsoleAndContinue(string cmd)
		{
			Process process = new Process();
			process.StartInfo.FileName = "cmd.exe";
			process.StartInfo.Arguments = "/k " + execute_filename_ + " " + cmd;
			process.StartInfo.UseShellExecute = true;
			process.StartInfo.CreateNoWindow = false;
			process.StartInfo.WorkingDirectory = working_directory_;

			process.Start();
		}

		public List<string> Run(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = execute_filename_;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.RedirectStandardError = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = working_directory_;

			StringArrayOutput output = new StringArrayOutput();
			process.OutputDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.ErrorDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.EnableRaisingEvents = true;

			process.Start();
			process.BeginOutputReadLine();
			process.BeginErrorReadLine();
			process.WaitForExit();

			return output.GetResult();
		}

		public async Task<List<string>> RunAsync(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = execute_filename_;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = working_directory_;

			StringArrayOutput output = new StringArrayOutput();
			process.OutputDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.EnableRaisingEvents = true;

			process.Start();
			process.BeginOutputReadLine();
			await Task.Run(() => process.WaitForExit());
			return output.GetResult();
		}

		public void RunWithoutWaiting(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = execute_filename_;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.WorkingDirectory = working_directory_;
			process.StartInfo.CreateNoWindow = true;

			process.Start();
		}

		public void RunShell(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = execute_filename_;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = true;
			process.StartInfo.CreateNoWindow = false;
			process.StartInfo.WorkingDirectory = working_directory_;

			process.Start();
		}

        public void RunShowDialog(string arguments)
        {
            var console_progress_window = new ConsoleProgressWindow(working_directory_, execute_filename_, arguments);
            console_progress_window.Owner = GlobalSetting.GetInstance().GetWindow();
            console_progress_window.ShowDialog();
        }
    }
}
