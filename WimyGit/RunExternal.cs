using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace WimyGit
{
  interface OutputInterface
  {
    void OnOutput(string output);
  }

  class StringArrayOutput : OutputInterface
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

  class RunExternal
  {
    private readonly string execute_filename_;
    private readonly string working_directory_;
    private readonly StringArrayOutput output_;

    public RunExternal(string execute_filename, string working_directory)
    {
      execute_filename_ = execute_filename;
      working_directory_ = working_directory;
      output_ = new StringArrayOutput();
    }

    public List<string> Run(string arguments)
    {
      Process process = new Process();
      process.StartInfo.FileName = execute_filename_;
      process.StartInfo.Arguments = arguments;
      process.StartInfo.UseShellExecute = false;
      process.StartInfo.RedirectStandardOutput = true;
      process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
      process.StartInfo.CreateNoWindow = true;
      process.StartInfo.WorkingDirectory = working_directory_;

      process.OutputDataReceived += OnOutputDataReceived;
      process.EnableRaisingEvents = true;
      process.Exited += OnExit;

      process.Start();
      process.BeginOutputReadLine();
      process.WaitForExit();

      return output_.GetResult();
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
