using System;
using System.Collections.Generic;
using System.IO;
using System.Windows.Controls;

namespace WimyGit
{
    class LastTabInfo
    {
        public class TabInfo
        {
            public string Directory {  get; set; }
            public bool IsFocused { get; set; }
        }

        public static LinkedList<TabInfo> Load()
        {
            LinkedList<TabInfo> tab_infos = new LinkedList<TabInfo>();

            string filename = GetSaveFileName();
            if (System.IO.File.Exists(filename) == false)
            {
                return tab_infos;
            }
            using (System.IO.TextReader reader = System.IO.File.OpenText(filename))
            {
                string file_contents = reader.ReadToEnd();
                foreach (string line in file_contents.Split(new string[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries))
                {
                    TabInfo tab_info = new TabInfo();

                    if (line.StartsWith("*"))
                    {
                        tab_info.IsFocused = true;
                        tab_info.Directory = line.Substring(1);
                    }
                    else
                    {
                        tab_info.IsFocused = false;
                        tab_info.Directory = line;
                    }
                    tab_infos.AddLast(tab_info);
                }
            }
            return tab_infos;
        }

        public static void Save(System.Windows.Controls.ItemCollection tab_items)
        {
            string filename = GetSaveFileName();
            using (TextWriter writer = File.CreateText(filename))
            {
                foreach (TabItem tab_item in tab_items)
                {
                    if (tab_item.Header is UserControls.RepositoryTabHeader == false)
                    {
                        continue;
                    }
                    string line = "";
                    if (tab_item.IsSelected)
                    {
                        line = "*";
                    }

                    var header = (UserControls.RepositoryTabHeader)tab_item.Header;
                    line += (string)header.Path.Content;

                    writer.WriteLine(line);
                }
            }
        }

        private static string GetSaveFileDirectory()
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        }

        private static string GetSaveFileName()
        {
            return GetSaveFileDirectory() + "\\" + "wimygit_tab.ini";
        }
    }
}
