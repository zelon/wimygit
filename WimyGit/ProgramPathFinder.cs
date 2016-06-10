using System;
using System.Diagnostics;

namespace WimyGit
{
    class ProgramPathFinder
    {
        public static string ExecuteAndGetOutput(string name, string argument)
        {
            Process process = new Process();
            process.StartInfo.FileName = name;
            process.StartInfo.Arguments = argument;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.CreateNoWindow = true;
            var output_builder = new System.Text.StringBuilder();
            process.OutputDataReceived += (object sender, DataReceivedEventArgs e) =>
            {
                output_builder.Append(e.Data);
            };
            process.Start();
            process.BeginOutputReadLine();
            process.WaitForExit();

            return output_builder.ToString();
        }

        public static string GetGitBin()
        {
            string[] git_path_candidates =
            {
                @"git.exe",
                @"C:\Program Files\Git\bin\git.exe",
                @"C:\Program Files (x86)\Git\bin\git.exe",
                @"C:\Users\" + Environment.UserName + @"\AppData\Local\Programs\Git\bin\git.exe",
            };

            foreach (string path in git_path_candidates)
            {
                try
                {
                    string output = ExecuteAndGetOutput(path, "--version");
                    if (output.IndexOf("git version") != -1)
                    {
                        return path;
                    }
                }
                catch (System.ComponentModel.Win32Exception)
                {
                    // Cannot execute the path as git.exe
                    continue;
                }
            }
            throw new System.IO.FileNotFoundException("Cannot find git binary");
        }

        public static string GetGitShell()
        {
            string[] git_path_candidates =
            {
                @"C:\Program Files (x86)\Git\bin\sh.exe",
                @"C:\Users\" + Environment.UserName + @"\AppData\Local\Programs\Git\bin\sh.exe",
            };

            foreach (string path in git_path_candidates)
            {
                if (System.IO.File.Exists(path))
                {
                    return path;
                }
            }
            throw new Exception("Cannot find git sh binary");
        }
    }
}
