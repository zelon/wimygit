using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;

namespace WimyGitLib
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
        public string WorkingDirectory { get; private set; }
        public string ExecuteFileName { get; private set; }
        private readonly bool _useDebugOutput = false;

		public RunExternal(string execute_filename, string working_directory)
		{
            ExecuteFileName = execute_filename;
			WorkingDirectory = working_directory;

            if (Debugger.IsAttached)
            {
                _useDebugOutput = true;
            }
		}

		public List<string> Run(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = ExecuteFileName;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.RedirectStandardError = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = WorkingDirectory;

			StringArrayOutput output = new StringArrayOutput();
			process.OutputDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.ErrorDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.EnableRaisingEvents = true;

			process.Start();
            if (_useDebugOutput)
            {
                Debug.WriteLine($"arguments: {arguments}");
            }
            process.BeginOutputReadLine();
			process.BeginErrorReadLine();
			process.WaitForExit();

			return output.GetResult();
		}

		public async Task<List<string>> RunAsync(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = ExecuteFileName;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.RedirectStandardOutput = true;
			process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
			process.StartInfo.CreateNoWindow = true;
			process.StartInfo.WorkingDirectory = WorkingDirectory;

			StringArrayOutput output = new StringArrayOutput();
			process.OutputDataReceived += (object sender, DataReceivedEventArgs e) => {
				output.OnOutput(e.Data);
			};
			process.EnableRaisingEvents = true;

			process.Start();
            if (_useDebugOutput)
            {
                Debug.WriteLine($"arguments: {arguments}");
            }

            process.BeginOutputReadLine();
			await Task.Run(() => process.WaitForExit());
			return output.GetResult();
		}

		public void RunWithoutWaiting(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = ExecuteFileName;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = false;
			process.StartInfo.WorkingDirectory = WorkingDirectory;
			process.StartInfo.CreateNoWindow = true;

			process.Start();
            if (_useDebugOutput)
            {
                Debug.WriteLine($"arguments: {arguments}");
            }
        }

        public void RunInShell(string arguments)
		{
			Process process = new Process();
			process.StartInfo.FileName = ExecuteFileName;
			process.StartInfo.Arguments = arguments;
			process.StartInfo.UseShellExecute = true;
			process.StartInfo.CreateNoWindow = false;
			process.StartInfo.WorkingDirectory = WorkingDirectory;

			process.Start();
            if (_useDebugOutput)
            {
                Debug.WriteLine($"arguments: {arguments}");
            }
        }

        public void RunInConsoleAndContinue(string arguments)
        {
            Process process = new Process();
            process.StartInfo.FileName = "cmd.exe";
            process.StartInfo.Arguments = "/k " + ExecuteFileName + " " + arguments;
            process.StartInfo.UseShellExecute = true;
            process.StartInfo.CreateNoWindow = false;
            process.StartInfo.WorkingDirectory = WorkingDirectory;

            process.Start();
            if (_useDebugOutput)
            {
                Debug.WriteLine($"arguments: {arguments}");
            }
        }
    }
}
