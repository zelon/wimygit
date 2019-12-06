using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;

namespace WimyGit
{
	public class StringArrayOutput
	{
		private readonly List<string> _result = new List<string>();

		public void OnOutput(string output)
		{
			if (output != null)
			{
				_result.Add(output);
			}
		}

		public List<string> GetResult()
		{
			return _result;
		}
	}

	public class RunExternal
	{
		private readonly string _execute_filename;
		private readonly string _working_directory;

		public RunExternal(string execute_filename, string working_directory)
		{
			_execute_filename = execute_filename;
			_working_directory = working_directory;
		}

		public List<string> Run(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = _execute_filename;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.RedirectStandardError = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = _working_directory;

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
			process.StartInfo.FileName = _execute_filename;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = _working_directory;

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
			process.StartInfo.FileName = _execute_filename;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.WorkingDirectory = _working_directory;
			process.StartInfo.CreateNoWindow = true;

			process.Start();
		}

		public void RunInShell(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = _execute_filename;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = true;
			process.StartInfo.CreateNoWindow = false;
			process.StartInfo.WorkingDirectory = _working_directory;

			process.Start();
		}

        public void RunInConsoleAndContinue(string cmd)
        {
            Process process = new Process();
            process.StartInfo.FileName = "cmd.exe";
            process.StartInfo.Arguments = "/k " + _execute_filename + " " + cmd;
            process.StartInfo.UseShellExecute = true;
            process.StartInfo.CreateNoWindow = false;
            process.StartInfo.WorkingDirectory = _working_directory;

            process.Start();
        }

        public void RunInConsoleProgressWindow(string arguments)
        {
            var console_progress_window = new ConsoleProgressWindow(_working_directory, _execute_filename, arguments);
            console_progress_window.Owner = GlobalSetting.GetInstance().GetWindow();
            console_progress_window.ShowDialog();
        }
    }
}
