using System.Collections.Generic;
using System.Windows.Controls;

namespace WimyGit.Config
{
	public class Model
	{
		public LinkedList<string> RecentRepositoryPaths { get; set; } = new LinkedList<string>();
		public LinkedList<TabInfo> LastTabInfos { get; set; } = new LinkedList<TabInfo>();

		public void AddRecentRepository(string repositoryPath)
		{
			RecentRepositoryPaths.Remove(repositoryPath);
			RecentRepositoryPaths.AddFirst(repositoryPath);
		}

		public void CollectTabInfo(ItemCollection tabItems)
		{
			LastTabInfos.Clear();

			bool hasFocused = false;
			foreach (TabItem tabItem in tabItems)
			{
				if (!(tabItem.Header is UserControls.RepositoryTabHeader header))
				{
					continue;
				}
				if (string.IsNullOrEmpty((string)header.Path.Content))
				{
					continue;
				}
				TabInfo tabInfo = new TabInfo
				{
					IsFocused = tabItem.IsSelected,
					Directory = (string)header.Path.Content
				};

				if (tabInfo.IsFocused)
				{
					hasFocused = true;
				}

				LastTabInfos.AddLast(tabInfo);
			}

			if (hasFocused == false && LastTabInfos.Count > 0)
			{
				LastTabInfos.Last.Value.IsFocused = true;
			}
		}
	}

	public class TabInfo
	{
		public string Directory { get; set; }
		public bool IsFocused { get; set; }
	}
}
