using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;

namespace WimyGit
{
    interface OutputInterface
    {
        void OnOutput(string output);
    }
    class RunExternal
    {
        private readonly string execute_filename_;
        private readonly OutputInterface output_;

        public RunExternal(string execute_filename, string working_directory, OutputInterface output)
        {
            execute_filename_ = execute_filename;
            output_ = output;
        }

        public void Run(string arguments)
        {
            Process process = new Process();
            process.StartInfo.FileName = execute_filename_;
            process.StartInfo.Arguments = arguments;
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.CreateNoWindow = true;

            process.OutputDataReceived += OnOutputDataReceived;
            process.EnableRaisingEvents = true;
            process.Exited += OnExit;

            process.Start();
            process.BeginOutputReadLine();
            process.WaitForExit();
        }

        public void RunWithoutWaiting(string arguments)
        {
            Process process = new Process();
            process.StartInfo.FileName = execute_filename_;
            process.StartInfo.Arguments = arguments;
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.CreateNoWindow = true;

            process.EnableRaisingEvents = true;
            process.Exited += OnExit;

            process.Start();
        }


        private void OnOutputDataReceived(object sender, DataReceivedEventArgs e)
        {
            if (output_ != null)
            {
                output_.OnOutput(e.Data);
            }
        }

        private void OnExit(object sender, EventArgs e)
        {
            Console.WriteLine(execute_filename_ + " exited");
        }
    }
}
