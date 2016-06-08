using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    class ProgramPathFinder
    {
        public static string GetGitBin()
        {
            string[] git_path_candidates =
            {
                @"C:\Program Files\Git\bin\git.exe",
                @"C:\Program Files (x86)\Git\bin\git.exe",
                @"C:\Users\" + Environment.UserName + @"\AppData\Local\Programs\Git\bin\git.exe",
            };

            foreach (string path in git_path_candidates)
            {
                if (System.IO.File.Exists(path))
                {
                    return path;
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
