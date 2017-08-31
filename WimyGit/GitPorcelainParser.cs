using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    public class GitFileStatus
    {
        public class Pair
        {
            public Pair(string filename, string description)
            {
                Filename = filename;
                Description = description;
            }

            public string Filename { get; private set; }
            public string Description { get; private set; }
        }
        public Pair Staged { get; private set; }
        public Pair Unmerged { get; private set; }
        public Pair Modified { get; private set; }

        public void SetStaged(string filename, string description)
        {
            Debug.Assert(Staged == null);
            Staged = new Pair(filename, description);
        }

        public void SetUnmerged(string filename, string description)
        {
            Debug.Assert(Unmerged == null);
            Unmerged = new Pair(filename, description);
        }

        public void SetModified(string filename, string description)
        {
            Debug.Assert(Modified == null);
            Modified = new Pair(filename, description);
        }
    }

    // https://git-scm.com/docs/git-status
    class GitPorcelainParser
    {
        public static GitFileStatus Parse(string line)
        {
            Debug.Assert(line.Length >= 4);

            GitFileStatus status = new GitFileStatus();
            string mark = line.Substring(0, 2);
            string filename = line.Substring(3);
            var splitted_renamed_filename = filename.Split(new string[] { " -> " }, StringSplitOptions.None);

            if (mark == "??")
            {
                status.SetModified(filename, "Untracked");
                return status;
            }
            if (mark == "!!")
            {
                status.SetModified(filename, "Ignored");
                return status;
            }

            switch (mark)
            {
                case "DD":
                    status.SetUnmerged(filename, "unmerged, both deleted");
                    return status;

                case "AU":
                    status.SetUnmerged(filename, "unmerged, added by us");
                    return status;

                case "UD":
                    status.SetUnmerged(filename, "unmerged, deleted by them");
                    return status;

                case "UA":
                    status.SetUnmerged(filename, "unmerged, added by them");
                    return status;

                case "DU":
                    status.SetUnmerged(filename, "unmerged, deleted by us");
                    return status;

                case "AA":
                    status.SetUnmerged(filename, "unmerged, both added");
                    return status;

                case "UU":
                    status.SetUnmerged(filename, "unmerged, both modified");
                    return status;
            }

            switch (mark[0])
            {
                case ' ':
                    break;

                case 'M':
                    status.SetStaged(filename, "Modified in stage");
                    break;

                case 'A':
                    status.SetStaged(filename, "Added in stage");
                    break;

                case 'D':
                    status.SetStaged(filename, "Deleted in stage");
                    break;

                case 'R':
                    status.SetStaged(filename, "Renamed in stage");
                    break;

                case 'C':
                    status.SetStaged(filename, "Copied in stage");
                    break;

                default:
                    Debug.Assert(false);
                    break;
            }
            switch (mark[1])
            {
                case ' ':
                    break;

                case 'M':
                    if (splitted_renamed_filename.Length == 1)
                    {
                        status.SetModified(filename, "Modified");
                    }
                    else
                    {
                        status.SetModified(splitted_renamed_filename[1], "Modified");
                    }
                    break;

                case 'D':
                    if (splitted_renamed_filename.Length == 1)
                    {
                        status.SetModified(filename, "Deleted");
                    }
                    else
                    {
                        status.SetModified(splitted_renamed_filename[1], "Deleted");
                    }
                    break;

                default:
                    Debug.Assert(false);
                    break;
            }
            return status;
        }
    }
}
