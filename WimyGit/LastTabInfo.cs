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
            // Collect tab infos
            LinkedList<TabInfo> tab_infos = new LinkedList<TabInfo>();
            bool has_focused = false;
            foreach (TabItem tab_item in tab_items)
            {
                if (tab_item.Header is UserControls.RepositoryTabHeader == false)
                {
                    continue;
                }
                var header = (UserControls.RepositoryTabHeader)tab_item.Header;
                if (string.IsNullOrEmpty((string)(header.Path.Content)))
                {
                    continue;
                }
                TabInfo tab_info = new TabInfo();
                tab_info.IsFocused = tab_item.IsSelected;
                tab_info.Directory = (string)header.Path.Content;

                if (tab_info.IsFocused)
                {
                    has_focused = true;
                }

                tab_infos.AddLast(tab_info);
            }

            if (has_focused == false)
            {
                tab_infos.Last.Value.IsFocused = true;
            }

            // Write to file
            using (TextWriter writer = File.CreateText(GetSaveFileName()))
            {
                foreach (TabInfo tab_info in tab_infos)
                {
                    string line = "";
                    if (tab_info.IsFocused)
                    {
                        line = "*";
                    }
                    line += tab_info.Directory;

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
