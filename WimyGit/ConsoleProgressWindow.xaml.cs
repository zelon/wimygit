using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Windows;

namespace WimyGit {
  /// <summary>
  /// Interaction logic for ConsoleProgressWindow.xaml
  /// </summary>
  public partial class ConsoleProgressWindow : Window {
    public ConsoleProgressWindow (string repository_path, List<string> cmds) {
      repository_path_ = repository_path;
      cmds_ = cmds;
      InitializeComponent();
    }

    private void Window_Initialized (Object sender, EventArgs e) {
    }

    private void PopOutput() {
      System.Windows.Forms.Application.DoEvents();
      while (outputs_.IsEmpty == false) {
        System.Windows.Forms.Application.DoEvents();
        string queue_output = "";
        if (outputs_.TryDequeue(out queue_output)) {
          textBlock.Text += queue_output;
        }
      }
    }

    private void Window_Loaded (Object sender, RoutedEventArgs e) {
      textBlock.Text = "";
      foreach (var cmd in cmds_)
      {
        outputs_.Enqueue(string.Format("git {0}", cmd) + Environment.NewLine);

        Process process = new Process();
        process.StartInfo.FileName = ProgramPathFinder.GetGitBin();
        process.StartInfo.Arguments = cmd;
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.RedirectStandardOutput = true;
        process.StartInfo.RedirectStandardError = true;
        process.StartInfo.StandardOutputEncoding = System.Text.Encoding.UTF8;
        process.StartInfo.CreateNoWindow = true;
        process.StartInfo.WorkingDirectory = repository_path_;

        StringArrayOutput output = new StringArrayOutput();
        process.OutputDataReceived += (object _, DataReceivedEventArgs console_output) => {
          if (console_output.Data == null) {
            return;
          }
          outputs_.Enqueue(console_output.Data + Environment.NewLine);
        };
        process.ErrorDataReceived += (object _, DataReceivedEventArgs error_output) => {
          if (error_output.Data == null) {
            return;
          }
          outputs_.Enqueue(error_output.Data + Environment.NewLine);
        };
        process.EnableRaisingEvents = true;

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        while (true) {
          if (process.WaitForExit(10)) {
            break;
          }
          if (canceled_) {
            process.Kill();
            break;
          }
          PopOutput();
        }
        if (process.ExitCode != 0) {
          PopOutput();
          textBlock.Text += "---- Error!!!";
          button.Content = "Close";
          return;
        }
      }
      PopOutput();
      if (canceled_ == false) {
        textBlock.Text += "All ok!!!";
      }
      done_ = true;
      button.Content = "Close";
    }

    private void button_Click (Object sender, RoutedEventArgs e) {
      if (canceled_ || done_) {
        this.Close();
        return;
      }
      canceled_ = true;
      textBlock.Text += "Cancel..." + Environment.NewLine;
    }

    private string repository_path_;
    private List<string> cmds_ = new List<string>();
    private ConcurrentQueue<string> outputs_ = new ConcurrentQueue<string>();
    private bool canceled_ = false;
    private bool done_ = false;
  }
}
