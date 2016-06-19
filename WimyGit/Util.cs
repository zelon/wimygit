using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    public static class Util
    {
        public static string WrapFilePath(string filename)
        {
            if (filename.StartsWith("\""))
            {
                return filename;
            }
            return string.Format("\"{0}\"", filename);
        }
    }
}
