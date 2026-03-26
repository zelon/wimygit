using System;
using System.Collections.Generic;
using System.IO;

namespace WimyGitLib
{
    public class GitAttributes
    {
        public static bool HasLfsGitAttribute(string repositoryDirectory)
        {
            string gitAttributesPath = Path.Combine(repositoryDirectory, ".gitattributes");
            if (!File.Exists(gitAttributesPath))
            {
                return false;
            }

            try
            {
                foreach (var line in File.ReadAllLines(gitAttributesPath))
                {
                    string trimmed = line.Trim();
                    if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#"))
                    {
                        continue;
                    }

                    if (trimmed.Contains("filter=lfs"))
                    {
                        return true;
                    }
                }
            }
            catch
            {
                // ignore
            }

            return false;
        }

        public static HashSet<string> GetLfsLockableExtensions(string repositoryDirectory)
        {
            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string gitAttributesPath = Path.Combine(repositoryDirectory, ".gitattributes");
            if (!File.Exists(gitAttributesPath))
            {
                return result;
            }

            try
            {
                foreach (var line in File.ReadAllLines(gitAttributesPath))
                {
                    string trimmed = line.Trim();
                    if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#"))
                    {
                        continue;
                    }

                    if (trimmed.Contains("lockable") && trimmed.Contains("filter=lfs"))
                    {
                        var parts = trimmed.Split(new char[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length == 0) continue;
                        
                        string pattern = parts[0];
                        if (pattern.StartsWith("*."))
                        {
                            result.Add(pattern.Substring(1)); // e.g. ".psd"
                        }
                    }
                }
            }
            catch
            {
                // ignore
            }

            return result;
        }
    }
}
