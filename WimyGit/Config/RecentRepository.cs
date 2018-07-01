using System;
using System.Collections.Generic;
using System.IO;

namespace WimyGit.Config
{
    class RecentRepository
    {
        private LinkedList<string> directory_list_;

        public RecentRepository()
        {
            directory_list_ = new LinkedList<string>();
            Load();
        }

        public LinkedList<string> GetList() { return directory_list_; }

        private void Load()
        {
            string filename = GetSaveFileName();
            if (System.IO.File.Exists(filename) == false)
            {
                return;
            }
            using (System.IO.TextReader reader = System.IO.File.OpenText(filename))
            {
                string file_contents = reader.ReadToEnd();
                foreach (string directory_name in file_contents.Split(new string[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (directory_name.Length > 0)
                    {
                        directory_list_.AddLast(directory_name);
                    }
                }
            }
        }

        public void Used(string directory)
        {
            directory_list_.Remove(directory);
            directory_list_.AddFirst(directory);

            Save();
        }

        private void Save()
        {
            string filename = GetSaveFileName();

            using (TextWriter writer = File.CreateText(filename))
            {
                foreach (string directory in directory_list_)
                {
                    writer.WriteLine(directory);
                }
            }
        }

        private string GetSaveFileDirectory()
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        }

        private string GetSaveFileName()
        {
            return GetSaveFileDirectory() + "\\" + "wimygit.ini";
        }
    }
}
