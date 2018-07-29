using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;

namespace WimyGit
{
    /// <summary>
    /// Interaction logic for ConsoleProgressWindow.xaml
    /// </summary>
    public partial class ConsoleProgressWindow : Window
    {
        enum CommandResult
        {
            kOk,
            kError,
            kCanceled
        }

        public ConsoleProgressWindow(string repository_path, List<string> cmds)
        {
            repository_path_ = repository_path;
            cmds_ = cmds;
            InitializeComponent();
        }

        private async void Window_Loaded(Object sender, RoutedEventArgs e)
        {
            textBox.Text = "";
            var task = Task<CommandResult>.Run(() => RunAndWait());

            var result = await task;
            switch (result)
            {
                case CommandResult.kOk:
                AddOutputText("All ok!!!");
                break;
                case CommandResult.kError:
                AddOutputText("Error!!!");
                break;
                case CommandResult.kCanceled:
                AddOutputText("Canceled!!!");
                break;
                default:
                System.Diagnostics.Debug.Assert(false);
                break;
            }
            done_ = true;
            button.Content = "Close";
        }

        private void AddOutputText(string text)
        {
            string inner_text = text + Environment.NewLine;
            if (textBox.Dispatcher.CheckAccess())
            {
                textBox.Text += inner_text;
                ScrollToEndConsole();
            }
            else
            {
                textBox.Dispatcher.BeginInvoke(new Action(() => {
                    textBox.Text += inner_text;
                    ScrollToEndConsole();
                }));
            }
        }

        private CommandResult RunAndWait()
        {
            foreach (var cmd in cmds_)
            {
                AddOutputText(string.Format("git {0}", cmd));

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
                    if (console_output.Data == null)
                    {
                        return;
                    }
                    AddOutputText(console_output.Data);
                };
                process.ErrorDataReceived += (object _, DataReceivedEventArgs error_output) => {
                    if (error_output.Data == null)
                    {
                        return;
                    }
                    AddOutputText(error_output.Data);
                };
                process.EnableRaisingEvents = true;

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                while (true)
                {
                    if (process.WaitForExit(10))
                    {
                        break;
                    }
                    if (canceled_)
                    {
                        process.Kill();
                        return CommandResult.kCanceled;
                    }
                }
                if (process.ExitCode != 0)
                {
                    return CommandResult.kError;
                }
            }
            return CommandResult.kOk;
        }

        private void button_Click(Object sender, RoutedEventArgs e)
        {
            if (canceled_ || done_)
            {
                this.Close();
                return;
            }
            canceled_ = true;
            textBox.Text += "Cancel..." + Environment.NewLine;
            ScrollToEndConsole();
        }

        public void ScrollToEndConsole()
        {
            textBox.ScrollToEnd();
        }

        private string repository_path_;
        private List<string> cmds_ = new List<string>();
        private bool canceled_ = false;
        private bool done_ = false;
    }
}
