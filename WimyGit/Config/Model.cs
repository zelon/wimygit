using System.Collections.Generic;
using System.Windows.Controls;

namespace WimyGit.Config
{
	public class Model
	{
		public LinkedList<string> RecentRepositoryPaths = new LinkedList<string>();
		public LinkedList<TabInfo> LastTabInfos = new LinkedList<TabInfo>();

		public void AddRecentRepository(string repository_path)
		{
			RecentRepositoryPaths.Remove(repository_path);
			RecentRepositoryPaths.AddFirst(repository_path);
		}

		public void CollectTabInfo(ItemCollection tabItems)
		{
			LastTabInfos.Clear();

			bool has_focused = false;
			foreach (TabItem tab_item in tabItems)
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

				LastTabInfos.AddLast(tab_info);
			}

			if (has_focused == false && LastTabInfos.Count > 0)
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
