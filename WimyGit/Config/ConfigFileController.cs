﻿using System;
using System.IO;
using System.Xml;

namespace WimyGit.Config
{
    public class ConfigFileController
    {
        public static void Save(Model model)
        {
            XmlDocument document = new System.Xml.XmlDocument();
            XmlElement root = document.CreateElement("wimygit_config");
            document.AppendChild(root);

            XmlElement recentRepositories = document.CreateElement("recent_repositories");
            foreach (string recentRepository in model.RecentRepositoryPaths)
            {
                XmlElement element = document.CreateElement("recent_repository");
                element.InnerText = recentRepository;
                recentRepositories.AppendChild(element);
            }
            root.AppendChild(recentRepositories);

            XmlElement lastTabs = document.CreateElement("last_tabs");
            foreach (var lastTabInfo in model.LastTabInfos)
            {
                XmlElement element = document.CreateElement("last_tab");

                XmlElement directory = document.CreateElement("directory");
                directory.InnerText = lastTabInfo.Directory;
                element.AppendChild(directory);

                XmlElement is_focused = document.CreateElement("is_focused");
                is_focused.InnerText = lastTabInfo.IsFocused.ToString();
                element.AppendChild(is_focused);

                lastTabs.AppendChild(element);
            }
            root.AppendChild(lastTabs);

            document.Save(GetSaveFilePath());
        }

        public static Model Load()
        {
            Model model = new Model();
            if (File.Exists(GetSaveFilePath()) == false)
            {
                return model;
            }
            XmlDocument document = new XmlDocument();
            document.Load(GetSaveFilePath());

            foreach (XmlNode node in document.GetElementsByTagName("recent_repository"))
            {
                model.RecentRepositoryPaths.AddLast(node.InnerText);
            }

            foreach (XmlNode node in document.GetElementsByTagName("last_tab"))
            {
                TabInfo tabInfo = new TabInfo() {
                    Directory = node.SelectSingleNode("directory").InnerText,
                    IsFocused = bool.Parse(node.SelectSingleNode("is_focused").InnerText)
                };
                model.LastTabInfos.AddLast(tabInfo);
            }
            return model;
        }

        private static string GetSaveFilePath()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "wimygit_config.xml");
        }
    }
}